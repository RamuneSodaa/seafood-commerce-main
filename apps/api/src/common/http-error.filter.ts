import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionBody = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    let message = 'Internal server error';
    let details: unknown = undefined;

    if (typeof exceptionBody === 'string') {
      message = exceptionBody;
    } else if (typeof exceptionBody === 'object' && exceptionBody !== null) {
      const body = exceptionBody as Record<string, unknown>;
      message = typeof body.message === 'string' ? body.message : message;
      details = body;
    }

    response.status(status).json({
      success: false,
      error: {
        code: status,
        message,
        details,
        path: request.url,
        timestamp: new Date().toISOString()
      }
    });
  }
}
