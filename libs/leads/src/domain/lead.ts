export interface LeadDraft {
  name: string;
  email: string;
  phone: string;
  establishmentName: string;
}

export interface Lead extends LeadDraft {
  id: string;
  createdAt: Date;
}
