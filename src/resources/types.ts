import type { MySqlTable } from "drizzle-orm/mysql-core";
import type { CATEGORY_TYPES } from "../db/schema/index.js";

export type Width = "full" | "half" | "third";
type Base = { name: string; label: string; help?: string; required?: boolean; notNull?: boolean; width?: Width; section?: string; placeholder?: string; readonly?: boolean };

export type SubField = { name: string; label: string; type: "text" | "textarea" | "url" | "number"; required?: boolean; placeholder?: string };

export type Field = Base &
  (
    | { type: "text" | "email" | "url" | "color"; max?: number }
    | { type: "textarea"; max?: number; rows?: number }
    | { type: "number"; min?: number; max?: number; step?: number }
    | { type: "date" | "datetime" }
    | { type: "slug"; source: string; allowSlash?: boolean }
    | { type: "boolean" }
    | { type: "select"; options: ReadonlyArray<readonly [string, string]> }
    | { type: "category"; categoryType: (typeof CATEGORY_TYPES)[number] }
    | { type: "relation"; resource: RelationSource }
    | { type: "icon" }
    | { type: "richtext" } // columns <name>Html + <name>Json
    | { type: "image" | "file"; accept: "image" | "pdf" | "image-or-pdf" }
    | { type: "list"; itemLabel?: string } // json string[]
    | { type: "steps" } // json [{title, description}]
    | { type: "ids"; resource: RelationSource } // json number[]
    | { type: "children"; table: MySqlTable; fk: string; subfields: SubField[]; itemLabel?: string }
    | { type: "gallery"; table: MySqlTable; fk: string }
    | { type: "join"; table: MySqlTable; fk: string; otherFk: string; resource: RelationSource }
    | { type: "tags" }
    | { type: "blocks" }
    | { type: "albumImages" }
  );

export type RelationSource = "projects" | "trainings" | "skills" | "certifications" | "courses" | "services" | "users" | "projectCategories";

export type Column = {
  key: string;
  label: string;
  kind?: "title" | "status" | "date" | "bool" | "category" | "image" | "badge" | "number" | "text" | "moderation" | "relation" | "rating";
  relation?: RelationSource;
  hideOnMobile?: boolean;
};

export type Filter =
  | { name: string; label: string; kind: "select"; options: ReadonlyArray<readonly [string, string]> }
  | { name: string; label: string; kind: "category"; categoryType: (typeof CATEGORY_TYPES)[number] }
  | { name: string; label: string; kind: "bool" };

export type ResourceDef = {
  key: string;
  label: string;
  singular: string;
  icon: string;
  table: MySqlTable;
  titleField: string;
  description?: string;
  fields: Field[];
  columns: Column[];
  search: string[];
  filters?: Filter[];
  /** Feature flags (brief §4: list/create/edit/duplicate/preview/status/featured/ordering/trash/SEO). */
  status?: boolean;
  featured?: boolean;
  ordering?: boolean;
  trash?: boolean;
  sample?: boolean;
  seo?: boolean;
  canCreate?: boolean;
  canDelete?: boolean;
  /** Public URL for preview / "view on site". */
  publicUrl?: (row: Record<string, unknown>) => string | null;
  /** Cache tags to bust on any change. */
  tags: string[];
  /** Extra defaults for new rows. */
  defaults?: Record<string, unknown>;
  /** Group of the editor sidebar fields. */
  sidebar?: string[];
  emptyHint?: string;
};
