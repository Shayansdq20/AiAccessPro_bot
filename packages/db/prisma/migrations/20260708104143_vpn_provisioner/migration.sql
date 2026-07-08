-- AlterEnum
ALTER TYPE "DeliveryType" ADD VALUE 'auto_api';

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "meta" JSONB;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "provisioner" TEXT,
ADD COLUMN     "provisionerConfig" JSONB;
