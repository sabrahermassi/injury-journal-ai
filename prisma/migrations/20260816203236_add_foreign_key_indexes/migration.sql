-- CreateIndex
CREATE INDEX "Injury_userId_idx" ON "Injury"("userId");

-- CreateIndex
CREATE INDEX "MedicalVisit_injuryId_idx" ON "MedicalVisit"("injuryId");

-- CreateIndex
CREATE INDEX "Symptom_injuryId_idx" ON "Symptom"("injuryId");

-- CreateIndex
CREATE INDEX "TimelineEvent_injuryId_idx" ON "TimelineEvent"("injuryId");

-- CreateIndex
CREATE INDEX "Treatment_injuryId_idx" ON "Treatment"("injuryId");
