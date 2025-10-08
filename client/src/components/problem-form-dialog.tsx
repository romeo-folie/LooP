import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChevronDown, Loader2, X } from "lucide-react";
import { format } from "date-fns";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandGroup,
  CommandList,
  CommandEmpty,
} from "@/components/ui/command";
import {
  Credenza,
  CredenzaContent,
  CredenzaDescription,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/credenza";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError, AxiosInstance } from "axios";

import type { ProblemResponse } from "@/pages/problems/ProblemDashboard";
import { Badge } from "./ui/badge";
import { toast } from "@/hooks/use-toast";
import { APIErrorResponse, useAxios } from "@/hooks/use-axios";

import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon } from "@radix-ui/react-icons";
import { startCase } from "lodash";
import { logger } from "@/lib/logger";
import { useNetworkStatus } from "@/context/network-status-provider";
import {
  addLocalProblem,
  getLocalProblem,
  ProblemSchema,
  updateLocalProblem,
} from "@/lib/db";

const difficultyLevels = ["Easy", "Medium", "Hard"] as const;
const notesPlaceholder =
  "Additional notes...\nTip: Use triple backticks for code fences, e.g. ```js …```";

// Zod schema for both "new" and "edit" flows
const problemSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .nonempty("Name is required"),
  difficulty: z.enum(difficultyLevels, {
    errorMap: () => ({ message: "Select a difficulty level" }),
  }),
  tags: z.array(z.string()).min(1, "At least one tag is required"),
  date_solved: z
    .date({
      required_error: "Please indicate the solve date",
    })
    .refine((date) => date.getTime() < Date.now(), {
      message: "Date solved cannot be in the future",
    }),
  notes: z.string().nonempty("Add a note"),
});

export type ProblemFormData = z.infer<typeof problemSchema>;

interface ProblemResponseData {
  message: string;
  problem: ProblemResponse | ProblemSchema;
}

async function createProblem(
  formData: ProblemFormData,
  apiClient: AxiosInstance,
  isOnline: boolean
): Promise<ProblemResponseData> {
  const payload = {
    ...formData,
    date_solved: formData.date_solved
      ? format(formData.date_solved, "yyyy-MM-dd")
      : undefined,
  };
  try {
    if (!isOnline) {
      const localProblem = {
        ...payload,
        isOffline: 1,
        local_id: `offline-${Date.now()}`,
        created_at: Date.now(),
      } as ProblemSchema;
      await addLocalProblem(localProblem);
      return {
        message: "Problem created offline",
        problem: localProblem,
      };
    }

    const { data } = await apiClient.post("/problems", payload);
    return data;
  } catch (error) {
    logger.error(`error requesting problem creation ${error}`);
    throw error;
  }
}

async function updateProblem(
  problemId: number | string,
  formData: ProblemFormData,
  apiClient: AxiosInstance,
  isOnline: boolean
): Promise<ProblemResponseData> {
  const payload = {
    ...formData,
    date_solved: formData.date_solved
      ? format(formData.date_solved, "yyyy-MM-dd")
      : undefined,
  };
  try {
    if (!isOnline) {
      const problemToEdit = await getLocalProblem(problemId);
      const problemWithUpdates = Object.assign(
        { ...(problemToEdit as ProblemSchema) },
        {
          ...payload,
          isOffline: 1,
        }
      );
      await updateLocalProblem(problemWithUpdates);
      return {
        message: "Problem updated offline",
        problem: {} as ProblemSchema,
      };
    }
    const { data } = await apiClient.put(`/problems/${problemId}`, payload);
    return data;
  } catch (error) {
    logger.error(`error requesting problem update ${error}`);
    throw error;
  }
}

// Props for the unified dialog
interface ProblemFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "new" | "edit";
  problem?: ProblemResponse | null;
  initialTagList: string[];
}

export default function ProblemFormDialog({
  isOpen,
  onOpenChange,
  mode,
  problem,
  initialTagList,
}: ProblemFormDialogProps) {
  const apiClient = useAxios();
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();

  // We use a single schema for both new & edit
  // We'll set defaultValues based on `problem` if mode=edit
  const [dropdownWidth, setDropdownWidth] = useState<number | null>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement | null>(null);

  // For typed tag input
  const [tagOptions, setTagOptions] = useState(initialTagList);
  const [inputValue, setInputValue] = useState("");
  const [isTagOpen, setIsTagOpen] = useState(false);

  const handleDropdownOpen = (opened: boolean) => {
    if (opened && dropdownTriggerRef.current) {
      setDropdownWidth(dropdownTriggerRef.current.offsetWidth);
    }
  };

  // Set default form values: if editing, fill from `problem`.
  const defaultVals: Partial<ProblemFormData> = useMemo(
    () =>
      mode === "edit" && problem
        ? {
            name: problem.name,
            difficulty: problem.difficulty as (typeof difficultyLevels)[number],
            tags: problem.tags,
            date_solved: problem.date_solved
              ? new Date(problem.date_solved)
              : undefined,
            notes: problem.notes || "",
          }
        : {
            name: "",
            difficulty: undefined,
            tags: [],
            date_solved: undefined,
            notes: "",
          },
    [mode, problem]
  );

  // React Hook Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProblemFormData>({
    resolver: zodResolver(problemSchema),
    defaultValues: defaultVals,
    mode: "onChange",
  });

  // If we switch from "new" to "edit" or vice versa, or problem changes, sync defaults
  // (Rare, but just in case.)
  useEffect(() => {
    reset(defaultVals);
  }, [problem, mode, reset, defaultVals]);

  useEffect(() => {
    setTagOptions(initialTagList);
  }, [initialTagList]);

  // Distinguish if we do create or update
  const mutation = useMutation<
    ProblemResponseData,
    AxiosError<APIErrorResponse>,
    ProblemFormData
  >({
    mutationFn: (formData) => {
      if (mode === "edit" && problem) {
        return updateProblem(
          (problem.problem_id as number) || (problem.local_id as string),
          formData,
          apiClient,
          isOnline
        );
      } else {
        return createProblem(formData, apiClient, isOnline);
      }
    },
    onSuccess: ({ message }) => {
      queryClient.invalidateQueries({ queryKey: ["problems"] });
      onOpenChange(false);
      reset();
      setInputValue("");
      toast({
        title: "Success",
        description: message,
      });
    },
    onError: (error) => {
      onOpenChange(false);
      reset();
      setInputValue("");
      const message = error.response?.data?.message || "Failed to save problem";
      toast({
        title: error.response?.data?.error,
        description: message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (formData: ProblemFormData) => {
    mutation.mutate(formData);
  };

  // Add typed tag
  const handleAddNewTag = (
    onChange: (tags: string[]) => void,
    currentTags: string[]
  ) => {
    const val = inputValue.trim();
    if (val && !tagOptions.includes(val)) {
      setTagOptions([...tagOptions, val]);
      onChange([...currentTags, val]);
    }
    setInputValue("");
    setIsTagOpen(false);
  };

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="px-6 pb-8 max-h-[95vh]">
        <CredenzaHeader className="text-left mb-4 pl-0">
          <CredenzaTitle className="text-xl lg:text-2xl font-bold">
            {mode === "edit" ? "Edit Problem" : "New Problem"}
          </CredenzaTitle>
          <CredenzaDescription>
            {mode === "edit"
              ? "Update the details of your problem."
              : "Enter problem details"}
          </CredenzaDescription>
        </CredenzaHeader>
        <div className="max-h-full p-1 drawer-content-wrapper">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Name Field */}
            <div>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input
                    placeholder="Problem Title"
                    className="h-10"
                    {...field}
                  />
                )}
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Difficulty Dropdown */}
            <div>
              <Controller
                name="difficulty"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <DropdownMenu onOpenChange={handleDropdownOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full h-10"
                        ref={dropdownTriggerRef}
                      >
                        {value || "Select Difficulty"}{" "}
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      style={{
                        width: dropdownWidth ? `${dropdownWidth}px` : "auto",
                      }}
                    >
                      {difficultyLevels.map((level) => (
                        <DropdownMenuItem
                          key={level}
                          onClick={() => onChange(level)}
                          className="h-10"
                        >
                          {level}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              />
              {errors.difficulty && (
                <p className="text-red-500 text-sm">
                  {errors.difficulty.message}
                </p>
              )}
            </div>

            {/* Tags Field with Custom Entry */}
            <div>
              <Controller
                name="tags"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <>
                    <Popover
                      open={isTagOpen}
                      onOpenChange={(open) => {
                        setIsTagOpen(open);
                        handleDropdownOpen(open);
                      }}
                      modal={true}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full h-10 truncate"
                        >
                          {value?.length > 0
                            ? value.map((val) => startCase(val)).join(", ")
                            : "Select or Add Tags"}{" "}
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="center"
                        style={{
                          width: dropdownWidth ? `${dropdownWidth}px` : "auto",
                        }}
                      >
                        <Command>
                          <CommandInput
                            placeholder="Search or add a tag..."
                            value={inputValue}
                            onValueChange={(v) => setInputValue(v)}
                          />
                          <CommandList className="max-h-40">
                            <CommandEmpty>No matching tags</CommandEmpty>
                            <CommandGroup>
                              {tagOptions.map((tag) => (
                                <CommandItem
                                  key={tag}
                                  onSelect={() => {
                                    if (value.includes(tag)) {
                                      onChange(value.filter((t) => t !== tag));
                                    } else {
                                      onChange([...value, tag]);
                                    }
                                  }}
                                >
                                  {value.includes(tag) ? <CheckIcon /> : ""}
                                  {startCase(tag)}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                        {/* Button to add a new typed tag */}
                        {inputValue && !tagOptions.includes(inputValue) && (
                          <Button
                            variant="outline"
                            className="w-full mt-2"
                            onClick={() => handleAddNewTag(onChange, value)}
                          >
                            Add "{inputValue}"
                          </Button>
                        )}
                      </PopoverContent>
                    </Popover>

                    {/* Display selected tags */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {value?.map((tag) => (
                        <Badge
                          key={tag}
                          className="flex items-center space-x-2"
                        >
                          {startCase(tag)}
                          <button
                            type="button"
                            onClick={() =>
                              onChange(value.filter((t) => t !== tag))
                            }
                          >
                            <X className="h-3 w-3 ml-1" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </>
                )}
              />
              {errors.tags && (
                <p className="text-red-500 text-sm">{errors.tags.message}</p>
              )}
            </div>

            {/* Date Solved Field */}
            <div>
              <Controller
                name="date_solved"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-10">
                        {value ? format(value, "PPP") : "Date Solved"}{" "}
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="center">
                      <Calendar
                        mode="single"
                        selected={value}
                        onSelect={(date) => onChange(date ?? undefined)}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.date_solved && (
                <p className="text-red-500 text-sm">
                  {errors.date_solved.message}
                </p>
              )}
            </div>

            {/* Notes Field */}
            <div>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <Textarea
                    placeholder={notesPlaceholder}
                    style={{ height: "250px" }}
                    {...field}
                  />
                )}
              />
              {errors.notes && (
                <p className="text-red-500 text-sm">{errors.notes.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Loader2 className="animate-spin mr-2" />
              ) : mode === "edit" ? (
                "Save"
              ) : (
                "Add Problem"
              )}
            </Button>
          </form>
        </div>
      </CredenzaContent>
    </Credenza>
  );
}
