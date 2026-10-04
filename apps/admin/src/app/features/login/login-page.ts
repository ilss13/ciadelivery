import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { readErrorCode } from '../../core/api-error';
import { homePath } from '../../core/access';
import { SessionService } from '../../core/session.service';

@Component({
  selector: 'admin-login-page',
  imports: [ReactiveFormsModule],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  readonly submitting = signal(false);
  readonly errorCode = signal('');
  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorCode.set('');
    const { email, password } = this.form.getRawValue();
    this.session.login(email, password).subscribe({
      next: (user) => {
        this.submitting.set(false);
        void this.router.navigateByUrl(homePath(user));
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.errorCode.set(readErrorCode(error));
      },
    });
  }
}
