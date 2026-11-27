import {
  applyCreatedProduct,
  assertCanCreateProducts,
  buildProductInsert,
  canCreateProducts,
  emptyProductForm,
  hasDuplicateProductCode,
  validateProductForm,
} from "../src/lib/product-input";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const ownerA = "11111111-1111-1111-1111-111111111111";
const ownerB = "22222222-2222-2222-2222-222222222222";
const catalog = [
  { id: "p1", owner_id: ownerA, code: "RAM-1" },
  { id: "p2", owner_id: ownerB, code: "RAM-1" },
];

const missing = validateProductForm(
  { ...emptyProductForm(), name: "  ", code: "", unit_price: "" },
  catalog,
  ownerA,
);
assert(missing.ok === false, "lege verplichte velden moeten falen");
if (!missing.ok) {
  assert(missing.errors.name === "Productnaam is verplicht", "naamfout");
  assert(missing.errors.code === "Productcode is verplicht", "codefout");
  assert(missing.errors.unit_price === "Basisprijs is verplicht", "prijsfout");
}

const duplicate = validateProductForm(
  { ...emptyProductForm(), name: "Raam", code: "ram-1", unit_price: "120" },
  catalog,
  ownerA,
);
assert(duplicate.ok === false, "dubbele code binnen dezelfde tenant moet falen");
if (!duplicate.ok)
  assert(duplicate.errors.code === "Deze productcode bestaat al", "dubbele-codeboodschap");

const otherTenant = validateProductForm(
  {
    ...emptyProductForm(),
    name: "Raam",
    code: "RAM-1",
    manufacturer: "Reynaers",
    unit_price: "90",
  },
  catalog,
  ownerB,
  "p2",
);
assert(otherTenant.ok === true, "eigen code mag bij bewerken blijven");

const sameCodeOtherTenant = validateProductForm(
  {
    ...emptyProductForm(),
    name: "Nieuw raam",
    code: "RAM-1",
    manufacturer: "Reynaers",
    unit_price: "90",
  },
  catalog,
  "33333333-3333-3333-3333-333333333333",
);
assert(sameCodeOtherTenant.ok === true, "dezelfde code bij een andere tenant is toegestaan");

const created = validateProductForm(
  {
    ...emptyProductForm(),
    name: "Schuifraam",
    code: "SCH-9",
    category: "Raam",
    manufacturer: "Schüco",
    description: "Korte tekst",
    unit_price: "250,5",
  },
  catalog,
  ownerA,
);
assert(created.ok === true, "geldig product moet slagen");
if (created.ok) {
  const row = buildProductInsert(ownerA, created.value);
  assert(row.owner_id === ownerA, "tenant is de ingelogde gebruiker");
  assert(!("owner_id" in created.value), "de clientpayload bevat geen owner_id");
  assert(row.manufacturer === "Schüco", "fabrikant blijft een productveld");
  assert(row.code === "SCH-9", "code wordt bewaard");
  assert(row.unit_price === 250.5, "komma-prijs wordt een getal");
}

assert(
  hasDuplicateProductCode(catalog, "ram-1", ownerA) === true,
  "code is case-insensitive per tenant",
);
assert(
  hasDuplicateProductCode(catalog, "ram-1", ownerB, "p2") === false,
  "eigen rij telt niet als duplicaat",
);
assert(
  hasDuplicateProductCode(catalog, "RAM-1", "other-tenant") === false,
  "andere tenant isoleert de code",
);

assert(canCreateProducts("installer") === true, "installateur mag aanmaken");
assert(canCreateProducts("admin") === true, "admin mag aanmaken");
assert(canCreateProducts(null) === false, "zonder rol geen knop");
assert(canCreateProducts("customer") === false, "klantrol mag niet aanmaken");
let denied = false;
try {
  assertCanCreateProducts(["customer"]);
} catch (error) {
  denied = error instanceof Error && error.message.includes("geen recht");
}
assert(denied, "server weigert een gebruiker zonder aanmaakrecht");
assertCanCreateProducts(["installer"]);

const kept = applyCreatedProduct(
  {
    product_id: "",
    option_name: "",
    option_value: "reeds ingevuld",
    unit_price: 10,
    unit: "stuk",
    width_mm: 1200,
    height_mm: 1400,
    quantity: 3,
  },
  { id: "new", name: "Schuifraam", description: "uit product", unit_price: 250.5, unit: "stuk" },
);
assert(kept.product_id === "new", "nieuw product wordt geselecteerd");
assert(
  kept.width_mm === 1200 && kept.height_mm === 1400 && kept.quantity === 3,
  "maten en aantal blijven",
);
assert(kept.option_value === "reeds ingevuld", "reeds ingevulde omschrijving blijft");
assert(kept.unit_price === 250.5, "basisprijs komt van het nieuwe product");

console.log("product-input checks passed");
