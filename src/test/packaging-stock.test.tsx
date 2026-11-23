import { render,screen } from "@testing-library/react";
import { expect,it } from "vitest";
import { StockBalance } from "@/components/packaging-stock";
const item={id:"qa",name:"QA fita",use_unit:"m" as const,active:true,minimum:5,last_stock_at:null};
it.each([[0,"Estoque zerado"],[5,"Estoque baixo"],[9.7,"Estoque normal"]] as const)("classifica saldo físico %s pelo mínimo", (stock_balance,label)=>{
  render(<StockBalance item={{...item,stock_balance}}/>);
  expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
});
