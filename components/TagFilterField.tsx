"use client";

import { useState } from "react";
import { TagMultiSelect, type TagRow } from "@/components/TagMultiSelect";

export function TagFilterField({
  tags,
  initial,
  name,
  label
}: {
  tags: TagRow[];
  initial: string[];
  name: string;
  label?: string;
}) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <TagMultiSelect
      tags={tags}
      value={value}
      onChange={setValue}
      name={name}
      allowCreate={true}
      label={label}
    />
  );
}
