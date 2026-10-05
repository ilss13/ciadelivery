import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SessionService } from './session.service';
import { usersGuard } from './settings.guard';

@Component({ template: 'equipe', standalone: true })
class TeamStub {}

@Component({ template: 'inicio', standalone: true })
class HomeStub {}

describe('usersGuard', () => {
  it('sends an attendant away from the team page', async () => {
    const url = await open(['orders.read'], 'ATTENDANT');
    expect(url).toBe('/inicio');
  });

  it('lets the owner open the team page', async () => {
    const url = await open(['users.manage'], 'OWNER');
    expect(url).toBe('/equipe');
  });
});

async function open(permissions: string[], role: string): Promise<string> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'equipe', canActivate: [usersGuard], component: TeamStub },
        { path: 'inicio', component: HomeStub },
      ]),
      {
        provide: SessionService,
        useValue: {
          user: () => ({
            id: 'user-1',
            name: 'Ana',
            email: 'ana@example.com',
            role,
            permissions,
          }),
        },
      },
    ],
  });
  const router = TestBed.inject(Router);
  await router.navigateByUrl('/equipe');
  return router.url;
}
