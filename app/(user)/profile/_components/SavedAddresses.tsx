"use client";

// SavedAddresses (owner 2026-06-29)
// ──────────────────────────────────────────────────────────────────────────────────────────────
// The manage surface for a buyer's saved delivery info, rendered at /profile/addresses
// (app/(user)/profile/addresses/page.tsx wraps this in ProtectedRoute). It lists each saved
// address as a Card and lets the buyer Add / Edit (a Dialog form), Delete (with an AlertDialog
// confirm), and Set as default. The same details power the checkout "saved address" picker in
// app/(user)/shop/_components/CartDetails.tsx, so editing here changes what is offered at checkout.
//
// DATA: all five operations go through lib/deliveryProfiles.ts (axios + Bearer token), which hits
// the /shop/delivery-profiles/* endpoints. The session token comes from AuthContext (useAuth),
// the same token CartDetails uses. The list comes back default-first.
//
// i18n: user-visible copy is sourced from the `savedDelivery` block of messages/en/shop.json via
// useTranslations("shop") -> t("savedDelivery.x"). Field labels use the provided field* keys.
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as RPNInput from "react-phone-number-input";
import {
  CountrySelect,
  FlagComponent,
  PhoneInput,
} from "@/components/PhoneNumberInput";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/PageHeader";
import { FullLoader, Loader } from "@/components/Loader";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconStar,
  IconMapPin,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  listDeliveryProfiles,
  createDeliveryProfile,
  updateDeliveryProfile,
  deleteDeliveryProfile,
  setDefaultDeliveryProfile,
  type DeliveryProfile,
} from "@/lib/deliveryProfiles";

// Validation for the Add/Edit dialog form. Mirrors lib/zodSchemas.tsx
// ShopCustomerDetailsSchema (same field rules so checkout + manage stay consistent),
// plus the optional `label` this surface lets the buyer name an address with.
const addressFormSchema = z.object({
  label: z.string().optional(),
  first_name: z.string().min(2, "First name is required"),
  last_name: z.string().min(2, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone_number: z.string().regex(/^(\+?\d{10,15})$/, {
    message: "Enter a valid phone number.",
  }),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  postcode: z.string().optional(),
});
type AddressFormType = z.infer<typeof addressFormSchema>;

const emptyForm: AddressFormType = {
  label: "",
  first_name: "",
  last_name: "",
  email: "",
  phone_number: "",
  address: "",
  city: "",
  state: "",
  postcode: "",
};

export function SavedAddresses() {
  const t = useTranslations("shop");
  const { token } = useAuth();

  const [profiles, setProfiles] = useState<DeliveryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  // The Add/Edit dialog: `editing` is the profile being edited, or null for Add.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryProfile | null>(null);
  const [saving, startSaving] = useTransition();
  // Guards the per-row Delete / Set-as-default actions against double clicks.
  const [busyId, setBusyId] = useState<number | null>(null);

  const form = useForm<AddressFormType>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: emptyForm,
  });

  // Load (and reload) the buyer's saved addresses (default-first). Non-blocking on
  // failure: we toast and leave the list as-is.
  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listDeliveryProfiles(token);
      setProfiles(data);
    } catch {
      toast.error(t("savedDelivery.loadFailedToast"));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Open the dialog for a brand-new address (empty form).
  const openAdd = () => {
    setEditing(null);
    form.reset(emptyForm);
    setDialogOpen(true);
  };

  // Open the dialog seeded with an existing address to edit.
  const openEdit = (p: DeliveryProfile) => {
    setEditing(p);
    form.reset({
      label: p.label || "",
      first_name: p.first_name || "",
      last_name: p.last_name || "",
      email: p.email || "",
      phone_number: p.phone_number || "",
      address: p.address || "",
      city: p.city || "",
      state: p.state || "",
      postcode: p.postcode || "",
    });
    setDialogOpen(true);
  };

  // Create or update, depending on whether we are editing an existing address.
  const onSubmit = (data: AddressFormType) => {
    if (!token) return;
    startSaving(async () => {
      try {
        if (editing) {
          await updateDeliveryProfile(
            { profile_id: editing.id, ...data },
            token,
          );
        } else {
          await createDeliveryProfile(data, token);
        }
        toast.success(t("savedDelivery.savedToast"));
        setDialogOpen(false);
        await refresh();
      } catch {
        toast.error(t("savedDelivery.saveFailedToast"));
      }
    });
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    setBusyId(id);
    try {
      await deleteDeliveryProfile(id, token);
      toast.success(t("savedDelivery.deletedToast"));
      await refresh();
    } catch {
      toast.error(t("savedDelivery.saveFailedToast"));
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = async (id: number) => {
    if (!token) return;
    setBusyId(id);
    try {
      await setDefaultDeliveryProfile(id, token);
      await refresh();
    } catch {
      toast.error(t("savedDelivery.saveFailedToast"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        back
        title={t("savedDelivery.managePageTitle")}
        description={t("savedDelivery.managePageDescription")}
        action={
          <Button onClick={openAdd} className="w-full md:w-auto">
            <IconPlus className="h-4 w-4" />
            {t("savedDelivery.addNew")}
          </Button>
        }
      />

      {loading ? (
        <FullLoader />
      ) : profiles.length === 0 ? (
        // Empty state: nudge the buyer to add their first address.
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IconMapPin className="h-10 w-10 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">
              {t("savedDelivery.empty")}
            </p>
            <Button onClick={openAdd} variant="outline">
              <IconPlus className="h-4 w-4" />
              {t("savedDelivery.addNew")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-3">
                {/* Name + (optional) label + default badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {p.first_name} {p.last_name}
                    </p>
                    {p.label && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.label}
                      </p>
                    )}
                  </div>
                  {p.is_default && (
                    <Badge
                      variant="outline"
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs"
                    >
                      {t("savedDelivery.defaultBadge")}
                    </Badge>
                  )}
                </div>

                {/* Address lines (commas, never dashes per AFC copy rule) */}
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <p>{p.address}</p>
                  <p>
                    {p.city}, {p.state}
                    {p.postcode ? `, ${p.postcode}` : ""}
                  </p>
                  <p>{p.phone_number}</p>
                  <p className="truncate">{p.email}</p>
                </div>

                {/* Actions: edit, set default (when not already), delete */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(p)}
                  >
                    <IconEdit className="h-4 w-4" />
                    {t("savedDelivery.edit")}
                  </Button>
                  {!p.is_default && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === p.id}
                      onClick={() => handleSetDefault(p.id)}
                    >
                      <IconStar className="h-4 w-4" />
                      {t("savedDelivery.setDefault")}
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={busyId === p.id}
                      >
                        <IconTrash className="h-4 w-4" />
                        {t("savedDelivery.delete")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t("savedDelivery.deleteConfirm")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {p.first_name} {p.last_name}, {p.address}, {p.city}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {t("savedDelivery.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(p.id)}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          {t("savedDelivery.delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Add / Edit dialog (shared form) ──────────────────────────────────────
          One Dialog drives both Add (editing == null) and Edit (editing == profile).
          Uses react-hook-form + zod like CartDetails so validation is consistent. */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editing
                ? t("savedDelivery.edit")
                : t("savedDelivery.addNew")}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 py-1"
            >
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("savedDelivery.fieldLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("savedDelivery.labelPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("savedDelivery.fieldFirstName")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("savedDelivery.fieldLastName")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("savedDelivery.fieldEmail")}</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("savedDelivery.fieldPhone")}</FormLabel>
                    <FormControl>
                      <RPNInput.default
                        className="flex rounded-md shadow-xs"
                        international
                        flagComponent={FlagComponent}
                        countrySelectComponent={CountrySelect}
                        inputComponent={PhoneInput}
                        placeholder="+2348012345679"
                        value={field.value}
                        onChange={(value) => field.onChange(value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("savedDelivery.fieldAddress")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("savedDelivery.fieldCity")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("savedDelivery.fieldState")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="postcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("savedDelivery.fieldPostcode")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={saving}
                >
                  {t("savedDelivery.cancel")}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader text={t("savedDelivery.save")} />
                  ) : (
                    t("savedDelivery.save")
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
