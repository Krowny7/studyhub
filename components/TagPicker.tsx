"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";
import { TagMultiSelect, type TagRow } from "@/components/TagMultiSelect";

export function TagPicker({
  value,
  onChange,
  label
}: {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();
  const [tags, setTags] = useState<TagRow[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (mounted) setTags([]);
        return;
      }
      const res = await supabase.from("tags").select("id,name,color").order("name", { ascending: true });
      if (!mounted) return;
      if (res.error) {
        console.error("TagPicker.load error", res.error);
        setTags([]);
        return;
      }
      setTags((res.data ?? []) as any);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  return (
    <div className="card-soft p-4">
      <div className="text-sm font-medium">{label ?? t("tags.title")}</div>
      <div className="mt-2">
        <TagMultiSelect tags={tags} value={value} onChange={onChange} allowCreate={true} />
      </div>
    </div>
  );
}
