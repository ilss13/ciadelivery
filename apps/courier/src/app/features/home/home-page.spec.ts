import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionService } from '../../core/session.service';
import { HomePage } from './home-page';

describe('HomePage', () => {
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideHttpClient()],
    }).compileComponents();
    fixture = TestBed.createComponent(HomePage);
  });

  it('shows the courier access message for other roles', () => {
    TestBed.inject(SessionService).currentUser.set({
      id: '1',
      name: 'Ana',
      role: 'OWNER',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Acesso do entregador');
  });
});
