CREATE TABLE "User" (
  "id" BIGSERIAL NOT NULL,
  "fullName" VARCHAR(100) NOT NULL,
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "passwordHash" VARCHAR(255) NULL,
  "isAdmin" BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY ("id")
);

CREATE TABLE "Machine" (
  "id" BIGSERIAL NOT NULL,
  "type" VARCHAR(255) NOT NULL,
  "department" VARCHAR(255) NOT NULL,
  "status" VARCHAR(255) NOT NULL,
  "hostname" VARCHAR(255) NOT NULL,
  "ipAddress" VARCHAR(255) NOT NULL,
  "ownerId" BIGINT NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "FK_Machine_ownerId"
    FOREIGN KEY ("ownerId")
      REFERENCES "User"("id")
);

CREATE TABLE "Ticket" (
  "id" BIGSERIAL NOT NULL,
  "adminId" BIGINT DEFAULT NULL,
  "userId" BIGINT NOT NULL,
  "machineId" BIGINT NOT NULL,
  "description" VARCHAR(255) NOT NULL,
  "priority" INTEGER NOT NULL,
  "isFixed" BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY ("id"),
  CONSTRAINT "FK_Ticket_adminId"
    FOREIGN KEY ("adminId")
      REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "FK_Ticket_userId"
    FOREIGN KEY ("userId")
      REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_Ticket_machineId"
    FOREIGN KEY ("machineId")
      REFERENCES "Machine"("id") ON DELETE CASCADE
);

CREATE TABLE "RefreshTokens" (
  "id" BIGSERIAL NOT NULL,
  "userId" BIGINT NOT NULL,
  "tokenId" VARCHAR(255) NOT NULL UNIQUE,
  "tokenHash" VARCHAR(255) NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "revokedAt" TIMESTAMPTZ NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "FK_RefreshTokens_userId"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
);

CREATE INDEX "IX_RefreshTokens_userId" ON "RefreshTokens" ("userId");
