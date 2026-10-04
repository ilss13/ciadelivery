import { Component, inject } from '@angular/core';
import { SessionService } from '../../core/session.service';

@Component({
  selector: 'courier-home-page',
  host: { class: 'stack' },
  template: `
    @if (user()?.role === 'COURIER') {
      <h1>Entregas</h1>
      <p>Você entrou. O painel de entregas ainda não está disponível.</p>
    } @else {
      <h1>Acesso do entregador</h1>
      <p>Esta entrada é só para quem faz as entregas.</p>
    }
  `,
})
export class HomePage {
  private readonly session = inject(SessionService);
  readonly user = this.session.currentUser;
}
