import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { GlucoseService } from '../glucose/glucose.service';

const FASTAPI_URL = 'http://127.0.0.1:8001/chat';
const GLUCOSE_FETCH_LIMIT = 100; // last 100 records sent as context

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(private readonly glucoseService: GlucoseService) {}

  async chat(
    patientId: string,
    userMessage: string,
  ): Promise<{ ai_response: string }> {
    // 1. Fetch the connected patient's glucose records
    const glucoseResult = await this.glucoseService.findMyRecords(patientId, {
      page: 1,
      limit: GLUCOSE_FETCH_LIMIT,
    });

    const glucoseRecords = glucoseResult.data.map((record) => ({
      value: record.value,
      measuredAt: record.measuredAt,
      period: record.period ?? null,
      note: record.note ?? null,
    }));

    // 2. Call the FastAPI server
    let rawData: unknown;
    try {
      const { data } = await axios.post(
        FASTAPI_URL,
        {
          user_message: userMessage,
          glucose_records: glucoseRecords,
        },
        {
          timeout: 30_000, // 30 seconds
          headers: { 'Content-Type': 'application/json' },
        },
      );
      rawData = data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosErr = error as AxiosError;
        if (!axiosErr.response) {
          // Network / unreachable
          this.logger.error(`FastAPI unreachable: ${axiosErr.message}`);
          throw new HttpException(
            'AI service is currently unavailable. Please try again later.',
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        // FastAPI returned a non-2xx status
        this.logger.error(
          `FastAPI returned ${axiosErr.response.status}: ${JSON.stringify(axiosErr.response.data)}`,
        );
        throw new HttpException(
          'AI service returned an error. Please try again later.',
          HttpStatus.BAD_GATEWAY,
        );
      }
      // Unexpected error
      this.logger.error(`Unexpected error calling FastAPI: ${error}`);
      throw new HttpException(
        'An unexpected error occurred.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // 3. Extract the AI text — handle several possible response shapes:
    //    { "response": "..." }  – expected
    //    { "message": "..." }   – common alternative
    //    "..."                  – plain string body
    this.logger.debug(`FastAPI raw response: ${JSON.stringify(rawData)}`);

    let aiText: string | undefined;

    if (typeof rawData === 'string' && rawData.trim() !== '') {
      aiText = rawData.trim();
    } else if (rawData && typeof rawData === 'object') {
      const obj = rawData as Record<string, unknown>;
      const candidate = obj['response'] ?? obj['message'] ?? obj['answer'] ?? obj['text'];
      if (typeof candidate === 'string' && candidate.trim() !== '') {
        aiText = candidate.trim();
      }
    }

    if (!aiText) {
      this.logger.error(
        `Could not extract AI text from FastAPI response: ${JSON.stringify(rawData)}`,
      );
      throw new HttpException(
        'AI service returned an invalid response.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return { ai_response: aiText };
  }
}
