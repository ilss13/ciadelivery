import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContactForm } from './contact-form';

@Component({
  selector: 'landing-home-page',
  imports: [RouterLink, ContactForm],
  templateUrl: './home-page.html',
})
export class HomePage {}
