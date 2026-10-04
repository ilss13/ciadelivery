import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { readErrorCode } from '../../core/api-error';
import { apiUrl } from '../../core/api-url';

@Component({
  selector: 'landing-contact-form',
  imports: [ReactiveFormsModule],
  templateUrl: './contact-form.html',
})
export class ContactForm {
  private readonly http = inject(HttpClient);
  private readonly formBuilder = inject(FormBuilder);

  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly errorCode = signal('');
  readonly form = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    establishmentName: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      this.errorCode.set('');
      return;
    }

    this.submitting.set(true);
    this.errorCode.set('');
    this.http
      .post(apiUrl('/api/v1/public/leads'), this.form.getRawValue())
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.sent.set(true);
          this.form.reset();
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorCode.set(readErrorCode(error));
        },
      });
  }
}
