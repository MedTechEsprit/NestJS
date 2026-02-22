import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { RegisterMedecinDto } from './dto/register-medecin.dto';
import { RegisterPharmacienDto } from './dto/register-pharmacien.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import type { Request } from 'express';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/patient')
  @ApiOperation({ summary: 'Inscription d\'un nouveau patient' })
  @ApiResponse({ status: 201, description: 'Patient créé avec succès' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async registerPatient(@Body() registerDto: RegisterPatientDto, @Req() request: Request) {
    const deviceInfo = this.extractDeviceInfo(request);
    const ipAddress = this.extractIpAddress(request);
    const userAgent = request.headers['user-agent'];

    return this.authService.registerPatient(registerDto, deviceInfo, ipAddress, userAgent);
  }

  @Post('register/medecin')
  @ApiOperation({ summary: 'Inscription d\'un nouveau médecin' })
  @ApiResponse({ status: 201, description: 'Médecin créé avec succès' })
  @ApiResponse({ status: 409, description: 'Email ou numéro d\'ordre déjà utilisé' })
  async registerMedecin(@Body() registerDto: RegisterMedecinDto, @Req() request: Request) {
    const deviceInfo = this.extractDeviceInfo(request);
    const ipAddress = this.extractIpAddress(request);
    const userAgent = request.headers['user-agent'];

    return this.authService.registerMedecin(registerDto, deviceInfo, ipAddress, userAgent);
  }

  @Post('register/pharmacien')
  @ApiOperation({ summary: 'Inscription d\'un nouveau pharmacien' })
  @ApiResponse({ status: 201, description: 'Pharmacien créé avec succès' })
  @ApiResponse({ status: 409, description: 'Email ou numéro d\'ordre déjà utilisé' })
  async registerPharmacien(@Body() registerDto: RegisterPharmacienDto, @Req() request: Request) {
    const deviceInfo = this.extractDeviceInfo(request);
    const ipAddress = this.extractIpAddress(request);
    const userAgent = request.headers['user-agent'];

    return this.authService.registerPharmacien(registerDto, deviceInfo, ipAddress, userAgent);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion d\'un utilisateur' })
  @ApiResponse({ status: 200, description: 'Connexion réussie' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides' })
  async login(@Body() loginDto: LoginDto, @Req() request: Request) {
    const deviceInfo = this.extractDeviceInfo(request);
    const ipAddress = this.extractIpAddress(request);
    const userAgent = request.headers['user-agent'];

    return this.authService.login(loginDto, deviceInfo, ipAddress, userAgent);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer le profil de l\'utilisateur connecté' })
  @ApiResponse({ status: 200, description: 'Profil récupéré' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile((user as UserDocument)._id.toString());
  }

  private extractDeviceInfo(request: Request): string {
    const userAgent = request.headers['user-agent'] || 'Unknown';
    if (userAgent.includes('Mobile')) return 'Mobile Device';
    if (userAgent.includes('Tablet')) return 'Tablet';
    return 'Desktop';
  }

  private extractIpAddress(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      request.ip ||
      'Unknown'
    );
  }
}
