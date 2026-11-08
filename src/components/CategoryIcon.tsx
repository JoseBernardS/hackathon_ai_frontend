import {
  Construction,
  Trash2,
  TrafficCone,
  Building2,
  PawPrint,
  TreePine,
  Droplets,
  HardHat,
  Volume2,
  Bug,
  Trees,
  CircleAlert,
  type LucideIcon,
} from 'lucide-react'

/**
 * Icons are keyed on a category's `group`, not its `code`, so a category the
 * server enables later draws something sensible without a client change.
 * Groups come from the registry: see lib/categories.ts.
 */
const BY_GROUP: Record<string, LucideIcon> = {
  roads: Construction,
  waste: Trash2,
  traffic: TrafficCone,
  property: Building2,
  animals: PawPrint,
  trees: TreePine,
  water: Droplets,
  construction: HardHat,
  nuisance: Volume2,
  pests: Bug,
  parks: Trees,
  other: CircleAlert,
}

export function iconForGroup(group: string): LucideIcon {
  return BY_GROUP[group] ?? CircleAlert
}

export function CategoryIcon({
  group,
  size = 16,
  strokeWidth = 2.3,
  className = '',
}: {
  group: string
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const Icon = iconForGroup(group)
  return <Icon size={size} strokeWidth={strokeWidth} className={className} />
}
