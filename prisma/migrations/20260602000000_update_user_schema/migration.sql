-- Add new columns
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "notes" TEXT;

-- Copy existing eMail values into email
UPDATE "User" SET "email" = "eMail";

-- Convert active from BOOLEAN to TEXT (true → 'active', false → 'inactive')
ALTER TABLE "User" ALTER COLUMN "active" TYPE TEXT USING CASE WHEN "active" THEN 'active' ELSE 'inactive' END;
ALTER TABLE "User" ALTER COLUMN "active" SET DEFAULT 'active';

-- Drop removed columns
ALTER TABLE "User" DROP COLUMN "eMail";
ALTER TABLE "User" DROP COLUMN "schoolGrade";
ALTER TABLE "User" DROP COLUMN "schoolTeacherName";
