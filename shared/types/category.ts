export interface CategoryDTO {
  id: string;
  name: string;
  rules: CategoryRule[];
}

export interface CategoryRule {
  field: string;
  operator: "eq" | "gte" | "lte" | "in";
  value: unknown;
}
