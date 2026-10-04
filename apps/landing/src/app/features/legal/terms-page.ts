import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'landing-terms-page',
  imports: [RouterLink],
  template: `
    <main class="section narrow">
      <h1>Termos</h1>
      <p>
        O ciadelivery oferece ao estabelecimento um canal próprio para receber
        pedidos. O uso da plataforma não transfere a relação com o cliente para
        um intermediário.
      </p>
      <p>
        Cardápio, preços, horários e atendimento são de responsabilidade do
        estabelecimento. O acesso pode ser suspenso em caso de uso abusivo.
      </p>
      <p><a routerLink="/">Voltar</a></p>
    </main>
  `,
})
export class TermsPage {}
