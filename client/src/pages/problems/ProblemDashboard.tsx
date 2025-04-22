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
import { startCase } from "lodash";
import { logger } from "@/lib/logger";
import {
  bulkAddProblems,
  clearOldProblems,
  deleteLocalProblem,
  getAllProblems,
  ReminderSchema,
} from "@/lib/db";
import { useNetworkStatus } from "@/context/network-status-provider";
import ProblemFeedbackDialog from "@/components/problem-feedback-dialog";
import { useNotifications } from "@/context/notification-provider";

export interface ReminderResponse {
  message?: string;
  reminder_id: number;
  problem_id: number;
  local_id?: string;
  due_datetime: Date;
  is_sent: boolean;
  sent_at: Date;
  created_at: Date;
}

export interface ReminderResponseData {
  message: string;
  reminder: ReminderResponse | ReminderSchema;
}
export interface ProblemResponse {
  problem_id: number;
  local_id?: string;
  user_id: number;
  name: string;
  difficulty: string;
  tags: string[];
  date_solved: Date;
  notes: string;
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

const fetchProblems = async (
  apiClient: AxiosInstance,
  isOnline: boolean,
  lastFetchRef: React.RefObject<number>,
) => {
  logger.info(`fetching problems, isOnline: ${isOnline}`);
  try {
    if (!isOnline) {
      const problems = await getAllProblems();
      return { problems };
    }

    const { data } = await apiClient.get("/problems");
    lastFetchRef.current = Date.now();
    return data;
  } catch (error) {
    logger.error(`error fetching problems ${error}`);
    throw error;
  }
};

const deleteProblem = async function (
  problemId: number | string,
  apiClient: AxiosInstance,
  isOnline: boolean,
): Promise<APISuccessResponse> {
  try {
    if (!isOnline) {
      await deleteLocalProblem(problemId);
      return {
        message: "Problem deleted offline",
      };
    }

    const { data } = await apiClient.delete(`/problems/${problemId}`);
    return data;
  } catch (error) {
    logger.error(`error requesting problem deletion ${error}`);
    throw error;
  }
};

const submitPracticeFeedback = async function (
  qualityScore: number,
  problemId: number,
  apiClient: AxiosInstance,
): Promise<APISuccessResponse> {
  try {
    const { data } = await apiClient.put(`/problems/${problemId}/practice`, {
      quality_score: qualityScore,
    });
    return data;
  } catch (error) {
    logger.error(`error submitting practice feedback ${error}`);
    throw error;
  }
};

export default function ProblemsDashboard() {
  const apiClient = useAxios();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const { removeNotification } = useNotifications();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [isProblemDialogOpen, setIsProblemDialogOpen] = useState(false);
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(
    null,
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
  const [isProblemFeedbackOpen, setIsProblemFeedbackOpen] = useState(false);
  const [feedbackId, setFeedbackId] = useState<number | null>(null);

  const lastLocalUpdateRef = useRef<number>(0);
  const lastFetchRef = useRef<number>(0);

  useEffect(() => {
    // Check localStorage for user’s notification preference
    const storedPref = browserStore.get("notificationsAllowed");
    if (!storedPref || storedPref === "false") {
      // No preference found => show the dialog once
      setShowNotificationRequestDialog(true);
    }
  }, []);

  // set feedback id when feedback route is hit
  useEffect(() => {
    if (location.search.includes("feedback_id")) {
      const params = new URLSearchParams(location.search);
      const feedback_id = params.get("feedback_id");
      setFeedbackId(Number(feedback_id));
      setIsProblemFeedbackOpen(true);
    }
  }, [location.pathname, location.search]);

  const handleDropdownOpen = (opened: boolean) => {
    if (opened && dropdownTriggerRef.current) {
      setDropdownWidth(dropdownTriggerRef.current.offsetWidth);
    }
  };

  // async function saveUserNotificationPreference(allowed: boolean) {
  //   try {
  //     console.log(
  // TODO:
  //       "make api call to save user preference. allowed: ",
  //       allowed.toString()
  //     );
  //   } catch (error) {
  //     console.error("Failed to save user preference on backend", error);
  //   }
  // }

  const handleNotificationConfirm = async () => {
    browserStore.set("notificationsAllowed", "true");
    // await saveUserNotificationPreference(true);
    const success = await requestNotificationPermission(apiClient);
    if (success)
      toast({
        title: "Success",
        description: "Subscribed to push notifications",
      });
    setShowNotificationRequestDialog(false);
  };

  const handleNotificationCancel = async () => {
    browserStore.set("notificationsAllowed", "false");
    // await saveUserNotificationPreference(false);
    setShowNotificationRequestDialog(false);
  };

  // Problem Dashboard
  const { data, isError, isSuccess, error, refetch } = useQuery<
    { problems: ProblemResponse[] },
    AxiosError<APIErrorResponse>
  >({
    queryKey: ["problems"],
    queryFn: () => fetchProblems(apiClient, isOnline, lastFetchRef),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // trigger problems query when device goes offline
  useEffect(() => {
    if (!isOnline) {
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  let problems: ProblemResponse[] = [];

  if (isSuccess) {
    problems = data.problems;
    if (
      isOnline &&
      lastFetchRef.current > lastLocalUpdateRef.current &&
      problems.length
    ) {
      logger.info("saving problems locally");
      clearOldProblems()
        .then(() => {
          logger.info("sucessfully cleared old problems from local DB");
          bulkAddProblems(problems.map((prob) => ({ ...prob, isOffline: 0 })))
            .then(() => {
              lastLocalUpdateRef.current = Date.now();
              logger.info("successfully added problems to local DB");
            })
            .catch((error) => {
              logger.error(`error saving problems to local DB ${error}`);
            });
        })
        .catch((error) => {
          logger.error(`error clearing old problems from local DB ${error}`);
        });
    }
  }

  if (isError) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Error fetching problems. Reload the page";
    toast({ title: "Error", description: message, variant: "destructive" });
  }

  // retrieve all problem tags
  let tags: string[] = [];
  if (problems.length) {
    tags = problems.reduce((accumulator: string[], problem) => {
      accumulator.push(
        ...problem.tags.filter((tag) => !accumulator.includes(tag)),
      );
      return accumulator;
    }, []);
  } else {
    tags = ["Array", "HashMap", "Sliding Window", "Heap", "Linked List"];
  }

  const deleteMutation = useMutation<
    APISuccessResponse,
    AxiosError<APIErrorResponse>,
    number | string
  >({
    mutationFn: (problem_id: number | string) =>
      deleteProblem(problem_id, apiClient, isOnline),
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
    deleteMutation.mutate(
      (selectedProblem!.problem_id as number) ||
        (selectedProblem!.local_id as string),
    );
  };

  const practiceMutation = useMutation<
    APISuccessResponse,
    AxiosError<APIErrorResponse>,
    number
  >({
    mutationFn: (qualityScore: number) =>
      submitPracticeFeedback(qualityScore, feedbackId as number, apiClient),
    onSuccess: ({ message }) => {
      removeNotification(feedbackId as number);
      queryClient.invalidateQueries({ queryKey: ["problems"] });
      navigate("/problems", { replace: true });
      toast({ title: "Success", description: message });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description:
          error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to submit practice feedback.",
        variant: "destructive",
      });
    },
  });

  const handlePracticeSubmit = (qualityScore: number) => {
    practiceMutation.mutate(qualityScore);
  };

  // Sync filters with URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearch(params.get("search") || "");
    setSelectedDifficulty(params.get("difficulty") || null);
    setSelectedTag(
      decodeURIComponent((params.get("tag") as string) || "") || null,
    );
    setSelectedDate(
      params.get("date_solved")
        ? parseISO(params.get("date_solved")!)
        : undefined,
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
  const problemsPerPage = isDesktop ? 10 : 5;
  const totalPages = Math.ceil(filteredProblems.length / problemsPerPage);
  const paginatedProblems = filteredProblems.slice(
    (currentPage - 1) * problemsPerPage,
    currentPage * problemsPerPage,
  );

  return (
    <div className="p-4 space-y-6 pb-8 min-h-screen max-w-screen">
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
                {selectedTag ? startCase(selectedTag) : "Tags"}{" "}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-40 overflow-y-auto"
              style={{
                width: dropdownWidth ? `${dropdownWidth}px` : "auto",
              }}
            >
              {tags.map((tag) => (
                <DropdownMenuItem key={tag} onClick={() => setSelectedTag(tag)}>
                  {startCase(tag)}
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
                key={problem.problem_id ?? problem.local_id}
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
                      <PopoverContent align="start" className="w-[600px]">
                        <ProblemDetail problem={problem} tags={tags} />
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
                      <ProblemDetail problem={problem} tags={tags} />
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
        initialTagList={tags}
        isOpen={isProblemDialogOpen}
        onOpenChange={setIsProblemDialogOpen}
      />

      {/* Reminder Form Dialog */}
      <ReminderFormDialog
        isOpen={isReminderDialogOpen}
        onOpenChange={setIsReminderDialogOpen}
        mode="new"
        problemId={
          (selectedProblem?.problem_id as number) ||
          (selectedProblem?.local_id as string)
        }
      />

      {/* The permission dialog */}
      <NotificationPermissionDialog
        isOpen={showNotificationRequestDialog}
        onOpenChange={(open) => setShowNotificationRequestDialog(open)}
        onConfirm={handleNotificationConfirm}
        onCancel={handleNotificationCancel}
      />

      {/* Problem Feedback Dialog */}
      <ProblemFeedbackDialog
        isOpen={isProblemFeedbackOpen}
        onOpenChange={setIsProblemFeedbackOpen}
        onSubmit={handlePracticeSubmit}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirmDelete={handleProblemDelete}
        resource="problem"
      />
    </div>
  );
}
