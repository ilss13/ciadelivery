import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MenuProduct } from './catalog.client';
import { ProductPicker } from './product-picker';

function product(available: boolean): MenuProduct {
  return {
    id: 'product-1',
    categoryId: 'category-1',
    name: 'Margherita',
    description: 'Molho e mussarela',
    priceCents: 3990,
    imageUrl: null,
    available,
    optionGroups: [
      {
        id: 'size',
        name: 'Tamanho',
        minSelect: 1,
        maxSelect: 1,
        options: [
          {
            id: 'grande',
            name: 'Grande',
            priceCents: 1000,
            available: true,
          },
        ],
      },
    ],
  };
}

describe('ProductPicker', () => {
  let fixture: ComponentFixture<ProductPicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductPicker],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductPicker);
  });

  it('does not emit add when the product is unavailable', () => {
    fixture.componentRef.setInput('product', product(false));
    const added = jest.fn();
    fixture.componentInstance.added.subscribe(added);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button.add',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    button.click();
    fixture.componentInstance.add();
    fixture.detectChanges();

    expect(added).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Indisponível');
  });
});
