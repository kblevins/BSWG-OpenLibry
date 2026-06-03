export interface UserType {
  createdAt?: string;
  updatedAt?: string;
  id?: number;
  lastName: string;
  firstName: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  active: string;
}
