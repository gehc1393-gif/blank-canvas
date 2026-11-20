import { z } from "zod";
import { presentationSizeSchema } from "./recipe-schema";

const id = z.string().min(1).max(100);
const nonnegative = z.number().finite().nonnegative();
const positive = z.number().finite().positive();
export const businessSchema = z.object({
  materials: z.array(z.object({ id, name: z.string().trim().min(1).max(80), unit: z.string().min(1), quantity: nonnegative, minimum: nonnegative, unitCost: nonnegative })),
  movements: z.array(z.object({ id, materialId: id, kind: z.enum(["entrada", "saida"]), quantity: positive, note: z.string(), createdAt: z.string().datetime({ offset: true }) })),
  products: z.array(z.object({ id, name: z.string().trim().min(1).max(80), batchYield: positive, recipe: z.array(z.object({ materialId: id, quantity: positive })), recipe_sheet_id: z.string().uuid().nullish(), units_per_presentation: presentationSizeSchema.nullish(), producedUnits: nonnegative, createdAt: z.string().datetime({ offset: true }) }).refine((product) => product.recipe_sheet_id ? product.recipe.length === 0 && product.units_per_presentation != null : product.recipe.length > 0, { message: "Selecione uma ficha técnica ou informe os ingredientes do produto." })),
  productions: z.array(z.object({ id, productId: id, batches: positive, units: positive, ingredient_cost: nonnegative.nullish(), createdAt: z.string().datetime({ offset: true }) })),
  sales: z.array(z.object({ id, productId: id, quantity: positive.int(), unitPrice: positive, unitCost: nonnegative, soldAt: z.string().datetime({ offset: true }) })),
  expenses: z.array(z.object({ id, description: z.string().trim().min(1).max(100), category: z.string().min(1), amount: positive, spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })),
  prices: z.record(nonnegative),
}).superRefine((data, ctx) => {
  const materials = new Set(data.materials.map((item) => item.id));
  const products = new Map(data.products.map((item) => [item.id, item]));
  for (const product of data.products) for (const item of product.recipe) {
    if (!materials.has(item.materialId)) ctx.addIssue({ code: "custom", message: "Ingrediente não encontrado." });
  }
  for (const item of data.movements) if (!materials.has(item.materialId)) ctx.addIssue({ code: "custom", message: "Ingrediente não encontrado." });
  for (const item of [...data.productions, ...data.sales]) if (!products.has(item.productId)) ctx.addIssue({ code: "custom", message: "Produto não encontrado." });
  for (const product of data.products) {
    const sold = data.sales.filter((sale) => sale.productId === product.id).reduce((total, sale) => total + sale.quantity, 0);
    if (sold > product.producedUnits) ctx.addIssue({ code: "custom", message: "Vendas excedem o estoque produzido." });
  }
  for (const key of Object.keys(data.prices)) if (!products.has(key)) ctx.addIssue({ code: "custom", message: "Produto não encontrado." });
});
export type BusinessData = z.infer<typeof businessSchema>;
export const emptyBusinessData: BusinessData = { materials: [], movements: [], products: [], productions: [], sales: [], expenses: [], prices: {} };
