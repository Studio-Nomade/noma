import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  servicePackageItems,
  servicePackages,
  serviceSubareas,
  serviceVariants,
  services,
  type Service,
  type ServicePackage,
  type ServicePackageItem,
  type ServiceSubarea,
  type ServiceVariant,
} from "@/db/schema";

export type ServiceWithVariants = Service & { variants: ServiceVariant[] };
export type ServicePackageWithItems = ServicePackage & {
  items: (ServicePackageItem & {
    serviceName: string;
    area: Service["area"];
  })[];
};

export async function listServices() {
  return db
    .select()
    .from(services)
    .orderBy(asc(services.area), asc(services.name));
}

export async function getService(id: string) {
  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, id))
    .limit(1);
  return service ?? null;
}

export async function listServicesWithVariants(): Promise<
  ServiceWithVariants[]
> {
  const catalog = await listServices();
  if (catalog.length === 0) return [];
  const variants = await db
    .select()
    .from(serviceVariants)
    .where(
      inArray(
        serviceVariants.serviceId,
        catalog.map((service) => service.id),
      ),
    )
    .orderBy(asc(serviceVariants.createdAt));
  const byService = new Map<string, ServiceVariant[]>();
  for (const variant of variants) {
    const list = byService.get(variant.serviceId) ?? [];
    list.push(variant);
    byService.set(variant.serviceId, list);
  }
  return catalog.map((service) => ({
    ...service,
    variants: byService.get(service.id) ?? [],
  }));
}

export async function listServiceSubareas(): Promise<ServiceSubarea[]> {
  return db
    .select()
    .from(serviceSubareas)
    .orderBy(asc(serviceSubareas.area), asc(serviceSubareas.name));
}

export async function listServicePackages(): Promise<
  ServicePackageWithItems[]
> {
  const packages = await db
    .select()
    .from(servicePackages)
    .orderBy(asc(servicePackages.name));
  if (packages.length === 0) return [];
  const items = await db
    .select({
      id: servicePackageItems.id,
      packageId: servicePackageItems.packageId,
      serviceId: servicePackageItems.serviceId,
      variantTier: servicePackageItems.variantTier,
      quantity: servicePackageItems.quantity,
      position: servicePackageItems.position,
      createdAt: servicePackageItems.createdAt,
      updatedAt: servicePackageItems.updatedAt,
      createdBy: servicePackageItems.createdBy,
      serviceName: services.name,
      area: services.area,
    })
    .from(servicePackageItems)
    .innerJoin(services, eq(servicePackageItems.serviceId, services.id))
    .where(
      inArray(
        servicePackageItems.packageId,
        packages.map((item) => item.id),
      ),
    )
    .orderBy(asc(servicePackageItems.position));
  return packages.map((item) => ({
    ...item,
    items: items.filter((line) => line.packageId === item.id),
  }));
}

/** Servicios activos de un área (para alimentar propuestas en Fase 4). */
export async function listActiveServicesByArea(area: string) {
  return db
    .select()
    .from(services)
    .where(eq(services.area, area as never))
    .orderBy(asc(services.name));
}
