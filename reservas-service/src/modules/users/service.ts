import type { UserDTO } from "@move/shared";

// F11 – gestión de usuarios
export async function listUsers(): Promise<UserDTO[]> {
  return [];
}

export async function getUser(id: string): Promise<UserDTO | null> {
  void id;
  return null;
}

export async function updateUser(
  id: string,
  dto: Partial<Omit<UserDTO, "id" | "createdAt">>
): Promise<UserDTO | null> {
  void id;
  void dto;
  return null;
}

export async function deleteUser(id: string): Promise<boolean> {
  void id;
  return false;
}
