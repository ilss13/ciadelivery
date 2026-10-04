import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'landing-privacy-page',
  imports: [RouterLink],
  template: `
    <main class="section narrow">
      <h1>Privacidade</h1>
      <p>
        Os dados enviados no formulário de contato — nome, email, telefone e
        nome do estabelecimento — servem só para responder ao seu interesse.
      </p>
      <p>
        Não vendemos esses dados e não usamos para publicidade de terceiros.
        Você pode pedir a exclusão pelo mesmo email informado no contato.
      </p>
      <p><a routerLink="/">Voltar</a></p>
    </main>
  `,
})
export class PrivacyPage {}
