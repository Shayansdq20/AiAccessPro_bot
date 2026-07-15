-- AlterTable
ALTER TABLE "ManualReceipt" ADD COLUMN     "image" BYTEA,
ADD COLUMN     "imageMime" TEXT,
ALTER COLUMN "telegramFileId" DROP NOT NULL,
ALTER COLUMN "userChatId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'bot';
