import { describe, expect, it } from "vitest";
import { blankSupplier, supplierSchema } from "@/lib/supplier-schema";

describe("cadastro de fornecedores", () => {
  const supplier = { ...blankSupplier, name: "Fornecedor de teste" };
  it("exige nome e aceita documento ausente", () => {
    expect(supplierSchema.safeParse({ ...supplier, name: "  " }).success).toBe(false);
    expect(supplierSchema.parse(supplier).document).toBe("");
  });
  it("normaliza e verifica os dígitos de CPF e CNPJ", () => {
    expect(supplierSchema.parse({ ...supplier, person_type: "PF", document: "529.982.247-25" }).document).toBe("52998224725");
    expect(supplierSchema.parse({ ...supplier, document: "04.252.011/0001-10" }).document).toBe("04252011000110");
    for (const document of ["04252011000111", "11111111111111", "52998224725"]) {
      expect(supplierSchema.safeParse({ ...supplier, document }).success).toBe(false);
    }
  });
});
