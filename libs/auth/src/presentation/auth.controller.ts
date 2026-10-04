import { APP_CONFIG, AppConfig, DomainException } from '@ciadelivery/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequestActor } from '@ciadelivery/users';
import {
  ForgotPassword,
  GetSession,
  ResetPassword,
} from '../application/password-reset';
import { Login, Logout, RefreshAccess } from '../application/session';
import { REFRESH_COOKIE } from '../domain/auth-policy';
import {
  AccessTokenResponse,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  UserResponse,
} from './auth.dto';
import { readCookie, refreshCookieOptions } from './cookies';
import { toUserBody } from './user-response';

interface AuthRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
  actor?: RequestActor;
}

interface CookieResponse {
  cookie(
    name: string,
    value: string,
    options: ReturnType<typeof refreshCookieOptions>,
  ): void;
}

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly loginUser: Login,
    private readonly refreshAccess: RefreshAccess,
    private readonly logoutUser: Logout,
    private readonly forgotPassword: ForgotPassword,
    private readonly resetPassword: ResetPassword,
    private readonly getSession: GetSession,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: AccessTokenResponse })
  async login(
    @Body() body: LoginDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AccessTokenResponse> {
    const session = await this.loginUser.execute({
      email: body.email,
      password: body.password,
      ip: clientIp(request),
    });
    this.writeRefreshCookie(response, session.refreshToken);
    return { accessToken: session.accessToken };
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ type: AccessTokenResponse })
  async refresh(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AccessTokenResponse> {
    const session = await this.refreshAccess.execute(
      readCookie(request.headers['cookie'], REFRESH_COOKIE),
    );
    this.writeRefreshCookie(response, session.refreshToken);
    return { accessToken: session.accessToken };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    await this.logoutUser.execute(
      readCookie(request.headers['cookie'], REFRESH_COOKIE),
    );
    response.cookie(REFRESH_COOKIE, '', {
      ...refreshCookieOptions(this.config.nodeEnv),
      maxAge: 0,
    });
  }

  @Post('forgot-password')
  @HttpCode(202)
  async forgot(@Body() body: ForgotPasswordDto): Promise<void> {
    await this.forgotPassword.execute(body.email);
  }

  @Post('reset-password')
  @HttpCode(204)
  async reset(@Body() body: ResetPasswordDto): Promise<void> {
    await this.resetPassword.execute(body.token, body.password);
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ type: UserResponse })
  async me(@Req() request: AuthRequest): Promise<UserResponse> {
    if (request.actor === undefined) {
      throw new DomainException(
        'UNAUTHENTICATED',
        'Authentication is required',
        401,
      );
    }

    return toUserBody(await this.getSession.execute(request.actor.userId));
  }

  private writeRefreshCookie(response: CookieResponse, token: string): void {
    response.cookie(
      REFRESH_COOKIE,
      token,
      refreshCookieOptions(this.config.nodeEnv),
    );
  }
}

function clientIp(request: AuthRequest): string {
  const address = request.ip ?? request.socket?.remoteAddress ?? '';
  return address.length > 0 ? address : 'unknown';
}
