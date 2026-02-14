import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../users/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { StatutCompte } from '../common/enums/statut-compte.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ user: Partial<User>; accessToken: string }> {
    const { email, motDePasse, role, ...rest } = registerDto;

    // Vérifier si l'email existe déjà
    const existingUser = await this.userModel.findOne({ email: email.toLowerCase() }).exec();
    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Hasher le mot de passe
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(motDePasse, saltRounds);

    // Créer l'utilisateur
    const newUser = new this.userModel({
      ...rest,
      email: email.toLowerCase(),
      motDePasse: hashedPassword,
      role,
      statutCompte: StatutCompte.ACTIF,
    });

    const savedUser = await newUser.save();

    // Générer le token JWT
    const payload = {
      sub: savedUser._id.toString(),
      email: savedUser.email,
      role: savedUser.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // Retourner l'utilisateur sans le mot de passe
    const { motDePasse: _, ...userResponse } = savedUser.toObject();

    return {
      user: userResponse,
      accessToken,
    };
  }

  async login(loginDto: LoginDto): Promise<{ user: Partial<User>; accessToken: string }> {
    const { email, motDePasse } = loginDto;

    // Trouver l'utilisateur par email
    const user = await this.userModel.findOne({ email: email.toLowerCase() }).exec();

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Vérifier le statut du compte
    if (user.statutCompte !== StatutCompte.ACTIF) {
      throw new UnauthorizedException('Compte suspendu');
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(motDePasse, user.motDePasse);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Générer le token JWT
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // Retourner l'utilisateur sans le mot de passe
    const { motDePasse: _, ...userResponse } = user.toObject();

    return {
      user: userResponse,
      accessToken,
    };
  }

  async validateUser(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId).exec();
  }

  async getProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    const { motDePasse: _, ...userResponse } = user.toObject();

    return userResponse;
  }
}
