import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  ChevronDown,
  MoreVertical,
  Plus,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import ProblemFormDialog from "@/components/problem-form-dialog";
import { AxiosError, AxiosInstance } from "axios";
import {
  APIErrorResponse,
  APISuccessResponse,
  useAxios,
} from "@/hooks/use-axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import LoadingScreen from "@/components/loading-screen";
import { toast } from "@/hooks/use-toast";
import ProblemDetail from "./ProblemDetail";
import NotificationPermissionDialog from "@/components/notification-permission-dialog";
import { requestNotificationPermission } from "@/lib/push-notifications";
import browserStore from "@/lib/browser-storage";
import DeleteConfirmationDialog from "@/components/delete-confirmation-dialog";
import ReminderFormDialog from "@/components/reminder-form-dialog";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Credenza,
  CredenzaContent,
  CredenzaDescription,
  CredenzaHeader,
  CredenzaTitle,
  CredenzaTrigger,
} from "@/components/credenza";

export interface ReminderResponse {
  message?: string;
  reminder_id: number;
  problem_id: number;
  due_datetime: Date;
  is_sent: boolean;
  sent_at: Date;
  created_at: Date;
}
export interface ProblemResponse {
  problem_id: number;
  user_id: number;
  name: string;
  difficulty: string;
  tags: string[];
  date_solved: Date;
  notes: string | null;
  created_at: Date;
  reminders: ReminderResponse[];
}

export interface Problem {
  name: string;
  difficulty: string;
  tags: string[];
  date_solved: Date | undefined;
  notes: string;
}

const difficultyColors: Record<string, string> = {
  Easy: "bg-green-500",
  Medium: "bg-yellow-500",
  Hard: "bg-red-500",
};

const fetchProblems = async (apiClient: AxiosInstance) => {
  const { data } = await apiClient.get("/problems");
  return data;
};

const deleteProblem = async function (
  problem_id: number,
  apiClient: AxiosInstance
): Promise<APISuccessResponse> {
  const { data } = await apiClient.delete(`/problems/${problem_id}`);
  return data;
};

const problemsPerPage = 10;

export default function ProblemsDashboard() {
  const apiClient = useAxios();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [isProblemDialogOpen, setIsProblemDialogOpen] = useState(false);
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(
    null
  );
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedProblem, setSelectedProblem] =
    useState<ProblemResponse | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [problemFormMode, setProblemFormMode] = useState<"new" | "edit">("new");

  const [dropdownWidth, setDropdownWidth] = useState<number | null>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [showNotificationRequestDialog, setShowNotificationRequestDialog] =
    useState(false);

  useEffect(() => {
    // Check localStorage for user’s notification preference
    const storedPref = browserStore.get("notificationsAllowed");
    if (!storedPref || storedPref === "false") {
      // No preference found => show the dialog once
      setShowNotificationRequestDialog(true);
    }
  }, []);

  const handleDropdownOpen = (opened: boolean) => {
    if (opened && dropdownTriggerRef.current) {
      setDropdownWidth(dropdownTriggerRef.current.offsetWidth);
    }
  };

  async function saveUserNotificationPreference(allowed: boolean) {
    try {
      console.log(
        //TODO:
        "make api call to save user preference. allowed: ",
        allowed.toString()
      );
    } catch (error) {
      console.error("Failed to save user preference on backend", error);
    }
  }

  const handleConfirm = async () => {
    browserStore.set("notificationsAllowed", "true");
    await saveUserNotificationPreference(true);
    await requestNotificationPermission(apiClient);
    setShowNotificationRequestDialog(false);
  };

  const handleCancel = async () => {
    browserStore.set("notificationsAllowed", "false");
    await saveUserNotificationPreference(false);
    setShowNotificationRequestDialog(false);
  };

  // Problem Dashboard
  const { data, isLoading, isError, error } = useQuery<
    { problems: ProblemResponse[] },
    AxiosError<APIErrorResponse>
  >({
    queryKey: ["problems"],
    queryFn: () => fetchProblems(apiClient),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isError) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Error fetching problems. Reload the page";
    toast({ title: "Error", description: message, variant: "destructive" });
  }

  const mutation = useMutation<
    APISuccessResponse,
    AxiosError<APIErrorResponse>,
    number
  >({
    mutationFn: (problem_id: number) => deleteProblem(problem_id, apiClient),
    onSuccess: ({ message }) => {
      queryClient.invalidateQueries({ queryKey: ["problems"] });
      toast({ title: "Success", description: message });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description:
          error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to delete problem.",
        variant: "destructive",
      });
    },
  });

  const handleProblemDelete = () => {
    mutation.mutate(selectedProblem!.problem_id);
  };

  const problems: ProblemResponse[] = data?.problems ?? [];

  // Sync filters with URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearch(params.get("search") || "");
    setSelectedDifficulty(params.get("difficulty") || null);
    setSelectedTag(params.get("tag") || null);
    setSelectedDate(
      params.get("date_solved")
        ? parseISO(params.get("date_solved")!)
        : undefined
    );
    setCurrentPage(Number(params.get("page")) || 1);
  }, [location.search]);

  // Update URL when filters change
  const updateQueryParams = () => {
    const params = new URLSearchParams();
    if (currentPage) params.set("page", currentPage.toString());
    if (search) params.set("search", search);
    if (selectedDifficulty) params.set("difficulty", selectedDifficulty);
    if (selectedTag) params.set("tag", selectedTag);
    if (selectedDate)
      params.set("date_solved", format(selectedDate, "yyyy-MM-dd"));

    navigate({ search: params.toString() }, { replace: true });
  };

  useEffect(updateQueryParams, [
    search,
    selectedDifficulty,
    selectedTag,
    selectedDate,
    currentPage,
    navigate,
  ]);

  // Reset Filters
  const resetFilters = () => {
    setSearch("");
    setSelectedDifficulty(null);
    setSelectedTag(null);
    setSelectedDate(undefined);
    setCurrentPage(1);
    navigate(`/problems?page=${currentPage}`);
  };

  const filteredProblems = problems.filter((problem) => {
    return (
      problem.name.toLowerCase().includes(search.toLowerCase()) &&
      (!selectedDifficulty || problem.difficulty === selectedDifficulty) &&
      (!selectedTag || problem.tags.includes(selectedTag)) &&
      (!selectedDate ||
        format(new Date(problem.date_solved!), "yyyy-MM-dd") ===
          format(selectedDate, "yyyy-MM-dd"))
    );
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredProblems.length / problemsPerPage);
  const paginatedProblems = filteredProblems.slice(
    (currentPage - 1) * problemsPerPage,
    currentPage * problemsPerPage
  );

  return (
    <>
      {isLoading ? (
        <LoadingScreen />
      ) : (
        <div className="p-4 space-y-6">
          {/* Header Section (Title & New Button) */}
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Problems</h1>
            <Button
              onClick={() => {
                setProblemFormMode("new");
                setIsProblemDialogOpen(true);
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>
          {/* Search & Filters Section */}
          <div className="flex flex-col flex-wrap gap-3 md:flex-row md:items-center">
            <Input
              placeholder="Search problems..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full lg:w-1/3 h-10 md:text-base lg:text-lg"
            />

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {/* Difficulty Filter */}
              <DropdownMenu onOpenChange={handleDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="lg"
                    className="flex-1"
                    ref={dropdownTriggerRef}
                  >
                    {selectedDifficulty ?? "Difficulty"}{" "}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  style={{
                    width: dropdownWidth ? `${dropdownWidth}px` : "auto",
                  }}
                >
                  {["Easy", "Medium", "Hard"].map((level) => (
                    <DropdownMenuItem
                      key={level}
                      onClick={() => setSelectedDifficulty(level)}
                    >
                      {level}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Tags Filter */}
              <DropdownMenu onOpenChange={handleDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="lg" className="flex-1">
                    {selectedTag ?? "Tags"}{" "}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  style={{
                    width: dropdownWidth ? `${dropdownWidth}px` : "auto",
                  }}
                >
                  {[
                    "Array",
                    "HashMap",
                    "Sliding Window",
                    "Heap",
                    "Linked List",
                  ].map((tag) => (
                    <DropdownMenuItem
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                    >
                      {tag}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Date Solved Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="lg" className="flex-1">
                    {selectedDate ? format(selectedDate, "PPP") : "Date Solved"}{" "}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                  />
                </PopoverContent>
              </Popover>
              {/* Reset Filters Button */}
              <Button
                variant="outline"
                className="flex items-center flex-1"
                size="lg"
                onClick={resetFilters}
              >
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
            </div>
          </div>
          {/* Problems List */}
          {paginatedProblems.length ? (
            <>
              <div className="border rounded-md">
                {paginatedProblems.map((problem) => (
                  <div
                    key={problem.problem_id}
                    className="flex items-center justify-between px-4 py-3 border-b last:border-none hover:bg-muted transition cursor-pointer"
                  >
                    {isDesktop ? (
                      <>
                        {/* Display popover for desktop */}
                        <Popover>
                          <PopoverTrigger asChild>
                            {/* Clickable Problem Title */}
                            <span className="text-base font-normal lg:text-lg hover:cursor-pointer hover:underline underline-offset-4">
                              {problem.name}
                            </span>
                          </PopoverTrigger>
                          {/* Popover Content with Problem Detail */}
                          <PopoverContent align="start" className="w-[500px]">
                            <ProblemDetail problem={problem} />
                          </PopoverContent>
                        </Popover>
                      </>
                    ) : (
                      <Credenza>
                        <CredenzaTrigger asChild>
                          {/* Clickable Problem Title */}
                          <span className="text-base font-normal lg:text-lg hover:cursor-pointer hover:underline underline-offset-4">
                            {problem.name}
                          </span>
                        </CredenzaTrigger>
                        <CredenzaContent className="px-4">
                          <CredenzaHeader className="p-0">
                            <CredenzaTitle className="sr-only">
                              Hidden Title for Screen Readers
                            </CredenzaTitle>
                            <CredenzaDescription className="sr-only">
                              Hidden Description for Screen Readers
                            </CredenzaDescription>
                          </CredenzaHeader>
                          <ProblemDetail problem={problem} />
                        </CredenzaContent>
                      </Credenza>
                    )}

                    <div className="flex items-center gap-4 ml-4">
                      {/* Difficulty Badge */}
                      <Badge
                        className={`${
                          difficultyColors[problem.difficulty]
                        } text-white`}
                      >
                        {problem.difficulty}
                      </Badge>

                      {/* More Options Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedProblem(problem);
                              setIsReminderDialogOpen(true);
                            }}
                          >
                            Add Reminder
                          </DropdownMenuItem>
                          {!isDesktop && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedProblem(problem);
                                setProblemFormMode("edit");
                                setIsProblemDialogOpen(true);
                              }}
                            >
                              Edit Problem
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setSelectedProblem(problem);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            Delete Problem
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-center sm:justify-end items-center gap-4 mt-4">
                  <Button
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => prev - 1)}
                  >
                    <ArrowLeft className="h-4 w-4" /> Prev
                  </Button>
                  <span className="text-sm font-medium">
                    {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                  >
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="border rounded-md p-4 text-center text-gray-500">
              No problems found
            </div>
          )}

          {/* Problem Form Dialog */}
          <ProblemFormDialog
            mode={problemFormMode}
            problem={selectedProblem}
            isOpen={isProblemDialogOpen}
            onOpenChange={setIsProblemDialogOpen}
          />

          {/* Reminder Form Dialog */}
          <ReminderFormDialog
            isOpen={isReminderDialogOpen}
            onOpenChange={setIsReminderDialogOpen}
            mode="new"
            problemId={selectedProblem?.problem_id as number}
          />

          {/* The permission dialog */}
          <NotificationPermissionDialog
            isOpen={showNotificationRequestDialog}
            onOpenChange={(open) => setShowNotificationRequestDialog(open)}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />

          {/* Delete Confirmation Dialog */}
          <DeleteConfirmationDialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            onConfirmDelete={handleProblemDelete}
            resource="problem"
          />
        </div>
      )}
    </>
  );
}
