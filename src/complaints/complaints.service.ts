import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Complaint, ComplaintDocument, ComplaintStatus } from './schemas/complaint.schema';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectModel(Complaint.name) private complaintModel: Model<ComplaintDocument>,
  ) {}

  async create(userId: string, userRole: string, dto: CreateComplaintDto): Promise<Complaint> {
    const complaint = new this.complaintModel({
      userId: new Types.ObjectId(userId),
      userRole,
      subject: dto.subject,
      message: dto.message,
      category: dto.category || 'general',
      status: ComplaintStatus.OPEN,
    });
    return complaint.save();
  }

  async findMine(userId: string): Promise<Complaint[]> {
    return this.complaintModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async findAll(options: {
    page?: number;
    limit?: number;
    status?: ComplaintStatus;
    userRole?: string;
  }): Promise<{ data: Complaint[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const filter: any = {};
    if (options.status) filter.status = options.status;
    if (options.userRole) filter.userRole = options.userRole;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.complaintModel
        .find(filter)
        .populate('userId', 'nom prenom email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.complaintModel.countDocuments(filter),
    ]);

    return { data, total };
  }

  async updateStatus(id: string, dto: UpdateComplaintStatusDto): Promise<Complaint> {
    const updated = await this.complaintModel
      .findByIdAndUpdate(
        id,
        {
          status: dto.status,
          adminNote: dto.adminNote || '',
        },
        { new: true },
      )
      .populate('userId', 'nom prenom email role')
      .exec();

    if (!updated) {
      throw new NotFoundException('Réclamation non trouvée');
    }

    return updated;
  }

  async getStats() {
    const grouped = await this.complaintModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const stats: Record<string, number> = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0,
      total: 0,
    };

    grouped.forEach((item) => {
      stats[item._id] = item.count;
      stats.total += item.count;
    });

    return stats;
  }
}