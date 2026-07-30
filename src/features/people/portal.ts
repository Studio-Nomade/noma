import "server-only";

import { and, asc, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { db } from "@/db";
import {
  employeeDocuments,
  employees,
  employeeTimeOff,
  teamMembers,
} from "@/db/schema";
import { PEOPLE_BUCKET, signedUrls } from "@/lib/supabase/storage";

export async function getPeopleDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const [employeeRows, documentStats, pendingTimeOff, members] =
    await Promise.all([
      db
        .select({
          id: employees.id,
          name: employees.name,
          roleTitle: employees.roleTitle,
          area: employees.area,
          status: employees.status,
          startDate: employees.startDate,
          linked: sql<boolean>`${employees.teamMemberId} is not null`,
        })
        .from(employees)
        .orderBy(asc(employees.name)),
      db
        .select({
          category: employeeDocuments.category,
          total: count(),
        })
        .from(employeeDocuments)
        .groupBy(employeeDocuments.category),
      db
        .select({
          id: employeeTimeOff.id,
          employeeName: employees.name,
          type: employeeTimeOff.type,
          startDate: employeeTimeOff.startDate,
          endDate: employeeTimeOff.endDate,
          days: employeeTimeOff.days,
          status: employeeTimeOff.status,
        })
        .from(employeeTimeOff)
        .innerJoin(employees, eq(employeeTimeOff.employeeId, employees.id))
        .where(
          and(
            eq(employeeTimeOff.status, "pending"),
            gte(employeeTimeOff.endDate, today),
          ),
        )
        .orderBy(asc(employeeTimeOff.startDate)),
      db
        .select({
          id: teamMembers.id,
          name: teamMembers.name,
          email: teamMembers.email,
        })
        .from(teamMembers)
        .leftJoin(employees, eq(employees.teamMemberId, teamMembers.id))
        .where(and(eq(teamMembers.status, "Activo"), isNull(employees.id)))
        .orderBy(asc(teamMembers.name)),
    ]);

  const areas = new Map<string, number>();
  for (const employee of employeeRows.filter(
    (item) => item.status === "ACTIVO",
  )) {
    const area = employee.area ?? "Sin área";
    areas.set(area, (areas.get(area) ?? 0) + 1);
  }
  return {
    employees: employeeRows,
    stats: {
      active: employeeRows.filter((item) => item.status === "ACTIVO").length,
      inactive: employeeRows.filter((item) => item.status !== "ACTIVO").length,
      unlinked: employeeRows.filter((item) => !item.linked).length,
      pendingTimeOff: pendingTimeOff.length,
    },
    areas: [...areas].map(([name, value]) => ({ name, value })),
    documentStats,
    pendingTimeOff,
    members,
  };
}

export async function getMyPeoplePortal(user: User) {
  const email = user.email?.toLowerCase() ?? "";
  const [profile] = await db
    .select({
      employeeId: employees.id,
      name: employees.name,
      roleTitle: employees.roleTitle,
      area: employees.area,
      status: employees.status,
      startDate: employees.startDate,
      photoUrl: teamMembers.photoUrl,
      email: teamMembers.email,
    })
    .from(teamMembers)
    .innerJoin(employees, eq(employees.teamMemberId, teamMembers.id))
    .where(
      sql`${teamMembers.userId} = ${user.id} or lower(${teamMembers.email}) = ${email}`,
    )
    .limit(1);
  if (!profile) return null;

  const [documents, timeOff] = await Promise.all([
    db
      .select({
        id: employeeDocuments.id,
        title: employeeDocuments.title,
        category: employeeDocuments.category,
        period: employeeDocuments.period,
        storagePath: employeeDocuments.storagePath,
        mimeType: employeeDocuments.mimeType,
        createdAt: employeeDocuments.createdAt,
      })
      .from(employeeDocuments)
      .where(
        and(
          eq(employeeDocuments.employeeId, profile.employeeId),
          eq(employeeDocuments.visibility, "employee"),
        ),
      )
      .orderBy(
        desc(employeeDocuments.period),
        desc(employeeDocuments.createdAt),
      ),
    db
      .select()
      .from(employeeTimeOff)
      .where(eq(employeeTimeOff.employeeId, profile.employeeId))
      .orderBy(desc(employeeTimeOff.startDate)),
  ]);
  const urls = await signedUrls(
    PEOPLE_BUCKET,
    documents.map((document) => document.storagePath),
  ).catch(() => new Map<string, string>());
  return {
    profile,
    documents: documents.map((document) => ({
      ...document,
      url: urls.get(document.storagePath) ?? null,
    })),
    timeOff,
  };
}
