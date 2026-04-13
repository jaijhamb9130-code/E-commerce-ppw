import { ExceptionFilter, Catch, NotFoundException, ArgumentsHost } from '@nestjs/common';
import { Response, Request } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';

@Catch(NotFoundException)
export class SpaFilter implements ExceptionFilter {
  private readonly customerIndex = join(process.cwd(), 'client', 'customer', 'index.html');
  private readonly adminIndex = join(process.cwd(), 'client', 'admin', 'index.html');

  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Non-API GET request without file extension → serve SPA index.html
    if (request.method === 'GET' && !request.path.startsWith('/api') && !request.path.includes('.')) {
      // Admin routes
      if (request.path.startsWith('/admin')) {
        return response.sendFile(this.adminIndex, (err) => {
          if (err && !response.headersSent) {
            response.status(404).json({ message: exception.message, error: 'Not Found', statusCode: 404 });
          }
        });
      }
      // Customer routes (everything else)
      return response.sendFile(this.customerIndex, (err) => {
        if (err && !response.headersSent) {
          response.status(404).json({ message: exception.message, error: 'Not Found', statusCode: 404 });
        }
      });
    }

    // Otherwise return normal 404
    response.status(404).json({
      message: exception.message,
      error: 'Not Found',
      statusCode: 404,
    });
  }
}
