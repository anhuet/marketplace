-- AlterTable
ALTER TABLE "listings" ADD COLUMN "buyer_id" TEXT;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
