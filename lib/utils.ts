export function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function classNames(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
