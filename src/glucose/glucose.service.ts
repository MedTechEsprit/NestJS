import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Glucose, GlucoseDocument } from './schemas/glucose.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateGlucoseDto } from './dto/create-glucose.dto';
import { UpdateGlucoseDto } from './dto/update-glucose.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationSeverity, NotificationType } from '../notifications/schemas/notification.schema';

@Injectable()
export class GlucoseService {
  constructor(
    @InjectModel(Glucose.name) private glucoseModel: Model<GlucoseDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private toMgDl(value: number, unit?: string): number {
    if ((unit || '').toLowerCase() == 'mmol/l') {
      return value * 18;
    }
    return value;
  }

  private evaluateAlert(valueMgDl: number): {
    isAbnormal: boolean;
    severity: NotificationSeverity;
    title: string;
    message: string;
  } {
    if (valueMgDl < 54) {
      return {
        isAbnormal: true,
        severity: NotificationSeverity.CRITICAL,
        title: 'Alerte glycémie critique basse',
        message: `Hypoglycémie sévère détectée: ${Math.round(valueMgDl)} mg/dL`,
      };
    }

    if (valueMgDl < 70) {
      return {
        isAbnormal: true,
        severity: NotificationSeverity.WARNING,
        title: 'Alerte glycémie basse',
        message: `Hypoglycémie détectée: ${Math.round(valueMgDl)} mg/dL`,
      };
    }

    if (valueMgDl > 250) {
      return {
        isAbnormal: true,
        severity: NotificationSeverity.CRITICAL,
        title: 'Alerte glycémie critique élevée',
        message: `Hyperglycémie sévère détectée: ${Math.round(valueMgDl)} mg/dL`,
      };
    }

    if (valueMgDl > 180) {
      return {
        isAbnormal: true,
        severity: NotificationSeverity.WARNING,
        title: 'Alerte glycémie élevée',
        message: `Hyperglycémie détectée: ${Math.round(valueMgDl)} mg/dL`,
      };
    }

    return {
      isAbnormal: false,
      severity: NotificationSeverity.INFO,
      title: '',
      message: '',
    };
  }

  private async findAuthorizedDoctorIds(patientId: string): Promise<string[]> {
    const patientObjectId = new Types.ObjectId(patientId);
    const doctors = await this.userModel.collection
      .find({
        role: { $regex: '^medecin$', $options: 'i' } as any,
        listePatients: patientObjectId,
      })
      .project({ _id: 1, patientAccessMap: 1 })
      .toArray();

    return doctors
      .filter((doctor: any) => {
        const accessMap = doctor?.patientAccessMap || {};
        const explicitAccess = accessMap[patientId];
        return explicitAccess == null ? true : Boolean(explicitAccess);
      })
      .map((doctor: any) => doctor._id.toString());
  }

  async canDoctorAccessPatient(doctorId: string, patientId: string): Promise<boolean> {
    const doctor = await this.userModel.collection.findOne({
      _id: new Types.ObjectId(doctorId),
      role: { $regex: '^medecin$', $options: 'i' } as any,
    });

    if (!doctor) {
      return false;
    }

    const linkedPatients = ((doctor as any)?.listePatients || []).map((id: any) => id.toString());
    const isLinked = linkedPatients.includes(patientId);

    if (!isLinked) {
      return false;
    }

    const accessMap = (doctor as any)?.patientAccessMap || {};
    const explicitAccess = accessMap[patientId];

    return explicitAccess == null ? true : Boolean(explicitAccess);
  }

  async create(patientId: string, createGlucoseDto: CreateGlucoseDto): Promise<Glucose> {
    const newGlucose = new this.glucoseModel({
      ...createGlucoseDto,
      patientId: new Types.ObjectId(patientId),
    });

    const savedGlucose = await newGlucose.save();

    try {
      const valueMgDl = this.toMgDl(createGlucoseDto.value, createGlucoseDto.unit);
      const alert = this.evaluateAlert(valueMgDl);

      if (alert.isAbnormal) {
        const [doctorIds, patient] = await Promise.all([
          this.findAuthorizedDoctorIds(patientId),
          this.userModel.findById(patientId).select('nom prenom').lean(),
        ]);

        if (doctorIds.length > 0) {
          const patientFullName = `${patient?.prenom || ''} ${patient?.nom || ''}`.trim() || 'Patient';
          const measuredAtLabel = new Date(createGlucoseDto.measuredAt).toLocaleString('fr-FR');
          const fullMessage = `${patientFullName}: ${alert.message} (${measuredAtLabel})`;

          await Promise.all(
            doctorIds.map((doctorId) =>
              this.notificationsService.send(
                doctorId,
                NotificationType.PATIENT_ALERT,
                alert.title,
                fullMessage,
                savedGlucose._id.toString(),
                alert.severity,
              ),
            ),
          );
        }
      }
    } catch (error) {
      console.error('Failed to dispatch glucose alert notifications:', error);
    }

    return savedGlucose;
  }

  async findMyRecords(
    patientId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Glucose>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const filter = { patientId: new Types.ObjectId(patientId) };

    const [records, total] = await Promise.all([
      this.glucoseModel
        .find(filter)
        .sort({ measuredAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.glucoseModel.countDocuments(filter).exec(),
    ]);

    return {
      data: records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByDateRange(
    patientId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Glucose[]> {
    return await this.glucoseModel
      .find({
        patientId: new Types.ObjectId(patientId),
        measuredAt: { $gte: startDate, $lte: endDate },
      })
      .sort({ measuredAt: -1 })
      .exec();
  }

  async findOne(id: string, patientId: string): Promise<Glucose> {
    const glucose = await this.glucoseModel
      .findOne({
        _id: id,
        patientId: new Types.ObjectId(patientId),
      })
      .exec();

    if (!glucose) {
      throw new NotFoundException('Enregistrement de glycémie non trouvé');
    }

    return glucose;
  }

  async update(
    id: string,
    patientId: string,
    updateGlucoseDto: UpdateGlucoseDto,
  ): Promise<Glucose> {
    const glucose = await this.glucoseModel
      .findOneAndUpdate(
        {
          _id: id,
          patientId: new Types.ObjectId(patientId),
        },
        { $set: updateGlucoseDto },
        { new: true },
      )
      .exec();

    if (!glucose) {
      throw new NotFoundException('Enregistrement de glycémie non trouvé');
    }

    return glucose;
  }

  async remove(id: string, patientId: string): Promise<{ message: string }> {
    const result = await this.glucoseModel
      .deleteOne({
        _id: id,
        patientId: new Types.ObjectId(patientId),
      })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Enregistrement de glycémie non trouvé');
    }

    return { message: 'Enregistrement supprimé avec succès' };
  }

  // ============ ANALYTICS ENDPOINTS ============

  async getWeeklyStats(patientId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const stats = await this.glucoseModel
      .aggregate([
        {
          $match: {
            patientId: new Types.ObjectId(patientId),
            measuredAt: { $gte: sevenDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            average: { $avg: '$value' },
            min: { $min: '$value' },
            max: { $max: '$value' },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    if (!stats || stats.length === 0) {
      return {
        average: 0,
        min: 0,
        max: 0,
        count: 0,
      };
    }

    return {
      average: Math.round(stats[0].average * 10) / 10,
      min: stats[0].min,
      max: stats[0].max,
      count: stats[0].count,
    };
  }

  async getMonthlyStats(patientId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stats = await this.glucoseModel
      .aggregate([
        {
          $match: {
            patientId: new Types.ObjectId(patientId),
            measuredAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            average: { $avg: '$value' },
            min: { $min: '$value' },
            max: { $max: '$value' },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    if (!stats || stats.length === 0) {
      return {
        average: 0,
        min: 0,
        max: 0,
        count: 0,
      };
    }

    return {
      average: Math.round(stats[0].average * 10) / 10,
      min: stats[0].min,
      max: stats[0].max,
      count: stats[0].count,
    };
  }

  async getDailyAverage(patientId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailyAverages = await this.glucoseModel
      .aggregate([
        {
          $match: {
            patientId: new Types.ObjectId(patientId),
            measuredAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$measuredAt' },
              month: { $month: '$measuredAt' },
              day: { $dayOfMonth: '$measuredAt' },
            },
            average: { $avg: '$value' },
            count: { $sum: 1 },
            date: { $first: '$measuredAt' },
          },
        },
        {
          $sort: { 'date': 1 },
        },
        {
          $project: {
            _id: 0,
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$date',
              },
            },
            average: { $round: ['$average', 1] },
            count: 1,
          },
        },
      ])
      .exec();

    return dailyAverages;
  }

  async getAlerts(patientId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const alerts = await this.glucoseModel
      .aggregate([
        {
          $match: {
            patientId: new Types.ObjectId(patientId),
            measuredAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            hypoCount: {
              $sum: {
                $cond: [{ $lt: ['$value', 70] }, 1, 0],
              },
            },
            hyperCount: {
              $sum: {
                $cond: [{ $gt: ['$value', 180] }, 1, 0],
              },
            },
            total: { $sum: 1 },
          },
        },
      ])
      .exec();

    if (!alerts || alerts.length === 0) {
      return {
        hypoCount: 0,
        hyperCount: 0,
        total: 0,
      };
    }

    return {
      hypoCount: alerts[0].hypoCount,
      hyperCount: alerts[0].hyperCount,
      total: alerts[0].total,
    };
  }

  async getHbA1c(patientId: string) {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const stats = await this.glucoseModel
      .aggregate([
        {
          $match: {
            patientId: new Types.ObjectId(patientId),
            measuredAt: { $gte: ninetyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            average: { $avg: '$value' },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    if (!stats || stats.length === 0 || stats[0].count === 0) {
      return {
        estimatedHbA1c: 0,
        averageGlucose: 0,
        count: 0,
      };
    }

    const averageGlucose = stats[0].average;
    
    // HbA1c estimation formula: (average glucose in mg/dL + 46.7) / 28.7
    // This is the ADAG (A1C-Derived Average Glucose) formula reversed
    const estimatedHbA1c = (averageGlucose + 46.7) / 28.7;

    return {
      estimatedHbA1c: Math.round(estimatedHbA1c * 10) / 10,
      averageGlucose: Math.round(averageGlucose * 10) / 10,
      count: stats[0].count,
    };
  }

  async getTimeInRange(patientId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const rangeStats = await this.glucoseModel
      .aggregate([
        {
          $match: {
            patientId: new Types.ObjectId(patientId),
            measuredAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            inRange: {
              $sum: {
                $cond: [
                  { $and: [{ $gte: ['$value', 70] }, { $lte: ['$value', 180] }] },
                  1,
                  0,
                ],
              },
            },
            belowRange: {
              $sum: {
                $cond: [{ $lt: ['$value', 70] }, 1, 0],
              },
            },
            aboveRange: {
              $sum: {
                $cond: [{ $gt: ['$value', 180] }, 1, 0],
              },
            },
            total: { $sum: 1 },
          },
        },
      ])
      .exec();

    if (!rangeStats || rangeStats.length === 0 || rangeStats[0].total === 0) {
      return {
        inRangePercent: 0,
        aboveRangePercent: 0,
        belowRangePercent: 0,
        inRangeCount: 0,
        aboveRangeCount: 0,
        belowRangeCount: 0,
        total: 0,
      };
    }

    const stats = rangeStats[0];
    const total = stats.total;

    return {
      inRangePercent: Math.round((stats.inRange / total) * 100 * 10) / 10,
      aboveRangePercent: Math.round((stats.aboveRange / total) * 100 * 10) / 10,
      belowRangePercent: Math.round((stats.belowRange / total) * 100 * 10) / 10,
      inRangeCount: stats.inRange,
      aboveRangeCount: stats.aboveRange,
      belowRangeCount: stats.belowRange,
      total: total,
    };
  }

  async getChartData(patientId: string, period: string = '7d') {
    let days = 7;
    if (period === '30d') days = 30;
    else if (period === '90d') days = 90;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const chartData = await this.glucoseModel
      .aggregate([
        {
          $match: {
            patientId: new Types.ObjectId(patientId),
            measuredAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$measuredAt' },
              month: { $month: '$measuredAt' },
              day: { $dayOfMonth: '$measuredAt' },
            },
            average: { $avg: '$value' },
            min: { $min: '$value' },
            max: { $max: '$value' },
            count: { $sum: 1 },
            date: { $first: '$measuredAt' },
          },
        },
        {
          $sort: { 'date': 1 },
        },
        {
          $project: {
            _id: 0,
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$date',
              },
            },
            average: { $round: ['$average', 1] },
            min: 1,
            max: 1,
            count: 1,
          },
        },
      ])
      .exec();

    return chartData;
  }

  async getTrend(patientId: string) {
    const now = new Date();
    
    // Last 7 days
    const last7DaysStart = new Date(now);
    last7DaysStart.setDate(last7DaysStart.getDate() - 7);
    
    // Previous 7 days (8-14 days ago)
    const previous7DaysStart = new Date(now);
    previous7DaysStart.setDate(previous7DaysStart.getDate() - 14);
    const previous7DaysEnd = new Date(now);
    previous7DaysEnd.setDate(previous7DaysEnd.getDate() - 7);

    const [lastWeek, previousWeek] = await Promise.all([
      this.glucoseModel
        .aggregate([
          {
            $match: {
              patientId: new Types.ObjectId(patientId),
              measuredAt: { $gte: last7DaysStart },
            },
          },
          {
            $group: {
              _id: null,
              average: { $avg: '$value' },
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),
      this.glucoseModel
        .aggregate([
          {
            $match: {
              patientId: new Types.ObjectId(patientId),
              measuredAt: { $gte: previous7DaysStart, $lt: previous7DaysEnd },
            },
          },
          {
            $group: {
              _id: null,
              average: { $avg: '$value' },
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),
    ]);

    if (!lastWeek || lastWeek.length === 0 || !previousWeek || previousWeek.length === 0) {
      return {
        trend: 'stable',
        difference: 0,
        lastWeekAverage: 0,
        previousWeekAverage: 0,
      };
    }

    const lastAvg = lastWeek[0].average;
    const prevAvg = previousWeek[0].average;
    const difference = lastAvg - prevAvg;

    let trend: 'improving' | 'worsening' | 'stable';
    
    // Threshold of 5 mg/dL for determining trend
    if (Math.abs(difference) < 5) {
      trend = 'stable';
    } else if (difference < 0) {
      // Lower glucose is improving
      trend = 'improving';
    } else {
      // Higher glucose is worsening
      trend = 'worsening';
    }

    return {
      trend,
      difference: Math.round(difference * 10) / 10,
      lastWeekAverage: Math.round(lastAvg * 10) / 10,
      previousWeekAverage: Math.round(prevAvg * 10) / 10,
    };
  }
}
