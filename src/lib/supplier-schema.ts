import { z } from "zod";

export const supplierFields = {
  name: "Nome ou razão social", trade_name: "Nome fantasia", document: "CPF/CNPJ",
  phone: "Telefone", whatsapp: "WhatsApp", email: "E-mail", contact: "Nome do contato",
  postal_code: "CEP", address: "Endereço", address_number: "Número", complement: "Complemento",
  district: "Bairro", city: "Cidade", state: "Estado", notes: "Observações",
} as const;
type Field = keyof typeof supplierFields;
const textFields = Object.fromEntries(Object.keys(supplierFields).map(key => [key, z.string().trim().max(3000)])) as Record<Field, z.ZodString>;

export function validDocument(doc: string, type: "PF" | "PJ") {
  if (!doc) return true;
  const cpf = type === "PF";
  if (!(cpf ? /^\d{11}$/ : /^[A-Z0-9]{12}\d{2}$/).test(doc) || /^(.)\1+$/.test(doc)) return false;
  const base = doc.slice(0, -2);
  function digit(value: string) {
    const sum = Array.from(value).reduce((total, c, i) =>
      total + (c.charCodeAt(0) - 48) * (cpf ? value.length + 1 - i : (value.length - 1 - i) % 8 + 2), 0);
    const remainder = sum % 11;
    return String(remainder < 2 ? 0 : 11 - remainder);
  }
  const first = digit(base);
  return doc === base + first + digit(base + first);
}

export const supplierSchema = z.object({
  ...textFields, name: z.string().trim().min(1, "Informe o nome ou razão social.").max(200),
  email: z.union([z.literal(""), z.string().email("E-mail inválido.")]),
  document: z.string().max(25).transform(value => value.trim().toUpperCase().replace(/[.\/-]/g, "")),
  person_type: z.enum(["PF", "PJ"]), active: z.boolean(),
}).refine(value => validDocument(value.document, value.person_type), "CPF/CNPJ inválido para o tipo selecionado.");
export type SupplierDraft = z.infer<typeof supplierSchema>;
export type Supplier = SupplierDraft & { id: string; code: number; created_at: string; updated_at: string };
export const blankSupplier: SupplierDraft = {
  ...Object.fromEntries(Object.keys(supplierFields).map(key => [key, ""])) as Record<Field, string>,
  person_type: "PJ", active: true,
};
