import { PrismaClient, BarcodeStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = 50;
  const batchId = "seed-demo";

  for (let i = 1; i <= count; i++) {
    const code = `VTG-${String(i).padStart(6, "0")}`;
    await prisma.barcode.upsert({
      where: { code },
      create: { code, batchId, status: BarcodeStatus.POOL },
      update: {},
    });
  }

  console.log(`Seeded ${count} barcodes (${batchId})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
