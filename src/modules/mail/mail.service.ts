import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend | null = null;
  private readonly mailFrom: string;

  constructor() {
    this.mailFrom = process.env.MAIL_FROM || 'onboarding@resend.dev';
  }

  async enviarCorreoPrueba(correoDestino: string): Promise<void> {
    try {
      const { error } = await this.getResendClient().emails.send({
        from: this.mailFrom,
        to: correoDestino,
        subject: 'Prueba Trayectoria',
        text: [
          'Hola.',
          '',
          'Este es un correo de prueba enviado desde Trayectoria.',
        ].join('\n'),
      });

      if (error) {
        this.logger.error(
          `Resend no pudo enviar el correo de prueba: ${error.message}`,
        );
        throw new InternalServerErrorException(
          'No fue posible enviar el correo de prueba.',
        );
      }
    } catch (error: unknown) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      this.logger.error(
        'Error inesperado al enviar correo de prueba con Resend.',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'No fue posible enviar el correo de prueba.',
      );
    }
  }

  async enviarCodigoRecuperacion(
    correoDestino: string,
    nombreUsuario: string,
    codigo: string,
  ): Promise<void> {
    try {
      const { error } = await this.getResendClient().emails.send({
        from: this.mailFrom,
        to: correoDestino,
        subject: 'Recuperación de contraseña - Trayectoria',
        text: [
          `Hola ${nombreUsuario},`,
          '',
          'Recibimos una solicitud para restablecer tu contraseña.',
          '',
          'Tu código de recuperación es:',
          '',
          codigo,
          '',
          'Este código expira en 10 minutos.',
          '',
          'Si no solicitaste este cambio, puedes ignorar este correo.',
        ].join('\n'),
      });

      if (error) {
        this.logger.error(
          `Resend no pudo enviar el código de recuperación: ${error.message}`,
        );
        throw new InternalServerErrorException(
          'No fue posible enviar el correo de recuperación.',
        );
      }
    } catch (error: unknown) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      this.logger.error(
        'Error inesperado al enviar código de recuperación con Resend.',
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'No fue posible enviar el correo de recuperación.',
      );
    }
  }

  private getResendClient(): Resend {
    if (this.resend) {
      return this.resend;
    }

    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      this.logger.error('RESEND_API_KEY no esta configurado.');
      throw new Error('RESEND_API_KEY no esta configurado.');
    }

    this.resend = new Resend(apiKey);
    return this.resend;
  }
}
