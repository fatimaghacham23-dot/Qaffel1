"use client";

import { useState } from "react";
import { deleteClientAction } from "@/app/actions";
import { toast } from "sonner";

interface ClientDeleteButtonProps {
  clientId: string;
  className?: string;
}

export function ClientDeleteButton({ clientId, className = "btn btn-danger text-xs" }: ClientDeleteButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleDelete = async (formData: FormData) => {
    try {
      await deleteClientAction(formData);
      toast.success("Client deleted successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete client.");
      setIsConfirming(false);
    }
  };

  if (isConfirming) {
    return (
      <form action={handleDelete} className="flex flex-wrap items-center gap-2">
        <input name="id" type="hidden" value={clientId} />
        <span className="text-xs font-semibold text-red-600 italic">Are you sure?</span>
        <button className="btn btn-danger text-xs" type="submit">
          Confirm delete
        </button>
        <button
          className="btn btn-secondary text-xs"
          onClick={() => setIsConfirming(false)}
          type="button"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <button
      className={className}
      onClick={() => setIsConfirming(true)}
      type="button"
    >
      Delete
    </button>
  );
}
