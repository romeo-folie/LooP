import { useEffect, useMemo, useRef, useState } from "react";
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
  ListFilter,
} from "lucide-react";
import { format } from "date-fns";
import ProblemFormDialog from "@/components/problem-form-dialog";
import { AxiosError, AxiosInstance } from "axios";
import {
  APIErrorResponse,
  APISuccessResponse,
  useAxios,
} from "@/hooks/use-axios";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
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
  CredenzaHeader,
  CredenzaTitle,
  CredenzaTrigger,
} from "@/components/credenza";
import { startCase } from "lodash";
import { logger } from "@/lib/logger";
import {
  deleteLocalProblem,
  getProblemsPageFromDB,
  ReminderSchema,
  saveFetchedProblemsToLocalDB,
} from "@/lib/db";
import { useNetworkStatus } from "@/context/network-status-provider";
import ProblemFeedbackDialog from "@/components/problem-feedback-dialog";
import { useNotifications } from "@/context/notification-provider";

export interface ReminderResponse {
  id?: number;
  isOffline?: number;
  reminder_id: number;
  problem_id: number;
  local_id?: string;
  due_datetime: Date;
  is_sent: boolean;
  sent_at: Date | string;
  created_at_millis: number;
}

export interface ReminderResponseData {
  message: string;
  reminder: ReminderResponse | ReminderSchema;
}
export interface ProblemResponse {
  id?: number;
  isOffline?: number;
  problem_id: number;
  local_id?: string;
  user_id: number;
  name: string;
  difficulty: string;
  tags: string[];
  date_solved: Date;
  notes: string;
  created_at: Date | string;
  created_at_millis: number;
  reminders: ReminderResponse[];
}

export interface Problem {
  name: string;
  difficulty: string;
  tags: string[];
  date_solved: Date | undefined;
  notes: string;
}

export type PageShape = {
  problems: ProblemResponse[];
  meta: {
    page: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
  };
};

export type AppQueryFilters = {
  queryStr?: string;
  difficulty?: string;
  tag?: string;
  date_solved?: string;
};

const difficultyColors: Record<string, string> = {
  Easy: "bg-green-500",
  Medium: "bg-yellow-500",
  Hard: "bg-red-500",
};

const fetchProblems = async (
  apiClient: AxiosInstance,
  isOnline: boolean,
  lastFetchRef: React.RefObject<number>,
  page: number,
  pageSize: number,
  queryFilters: AppQueryFilters,
) => {
  logger.info(`fetching problems, isOnline: ${isOnline}`);
  try {
    if (!isOnline) {
      return await getProblemsPageFromDB({ ...queryFilters }, page, pageSize);
    }

    const { data } = await apiClient.get("/problems", {
      params: { page, pageSize, ...queryFilters },
    });
    lastFetchRef.current = Date.now();

    saveFetchedProblemsToLocalDB(data.problems);
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

  // const [currentPage, setCurrentPage] = useState(1);
  const [showNotificationRequestDialog, setShowNotificationRequestDialog] =
    useState(false);
  const [isProblemFeedbackOpen, setIsProblemFeedbackOpen] = useState(false);
  const [feedbackId, setFeedbackId] = useState<number | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<AppQueryFilters>({});

  const filtersForQuery = useMemo<AppQueryFilters>(
    () => ({
      queryStr: appliedFilters.queryStr || undefined,
      difficulty: appliedFilters.difficulty || undefined,
      tag: appliedFilters.tag || undefined,
      date_solved: appliedFilters.date_solved || undefined,
    }),
    [appliedFilters],
  );

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

  const handleNotificationConfirm = async () => {
    browserStore.set("notificationsAllowed", "true");
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
    setShowNotificationRequestDialog(false);
  };

  const problemsPerPage = isDesktop ? 10 : 5;

  const fetchProblemsPage = async ({ pageParam }: { pageParam?: unknown }) => {
    const page =
      typeof pageParam === "number" ? pageParam : Number(pageParam ?? 1);
    const resp = await fetchProblems(
      apiClient,
      isOnline,
      lastFetchRef,
      page,
      problemsPerPage,
      filtersForQuery,
    );
    return resp as PageShape;
  };
  // Problem Dashboard
  const {
    data,
    error,
    isSuccess,
    isError,
    isFetchingNextPage,
    isFetchingPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    refetch,
  } = useInfiniteQuery<PageShape, AxiosError<APIErrorResponse>>(
    // query key depends on applied filters + per-page so cache entries are separate
    {
      queryKey: ["problems", filtersForQuery, problemsPerPage],
      queryFn: fetchProblemsPage,
      initialPageParam: 1,
      getNextPageParam: (lastPage) =>
        lastPage.meta.page < lastPage.meta.totalPages
          ? lastPage.meta.page + 1
          : undefined,
      getPreviousPageParam: (firstPage) =>
        firstPage.meta.page > 1 ? firstPage.meta.page - 1 : undefined,
      enabled: isOnline,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      staleTime: 1000 * 60 * 2,
    },
  );

  // trigger problems query when device goes offline
  useEffect(() => {
    if (!isOnline) refetch();
  }, [isOnline, refetch]);

  useEffect(() => {
    refetch();
  }, [filtersForQuery, refetch]);

  // derive pagination info
  const pages = data?.pages ?? [];
  const totalPages = pages.length > 0 ? pages[0].meta.totalPages : 1;

  const [currentPageIndex, setCurrentPageIndex] = useState<number>(() =>
    pages.length > 0 ? pages.length - 1 : 0,
  );

  // sync pointer to last-loaded page on initial load / filters change
  useEffect(() => {
    setCurrentPageIndex(pages.length > 0 ? pages.length - 1 : 0);
    // depend on pages.length (and filter deps if you reset filters externally)
  }, [pages.length]);

  const currentPageObj = pages[currentPageIndex];
  const currentPage = currentPageObj?.meta.page ?? 1;
  const currentPageProblems = currentPageObj?.problems ?? [];

  const handlePrev = async () => {
    // If we already have a previous page cached, just move the pointer left
    if (currentPageIndex > 0) {
      setCurrentPageIndex((i) => i - 1);
      return;
    }

    // Otherwise, request the previous page from the server (will be prepended)
    if (hasPreviousPage && !isFetchingPreviousPage) {
      await fetchPreviousPage();
      // newly fetched page is prepended at index 0; set pointer to 0 so UI shows it
      setCurrentPageIndex(0);
    }
  };

  const handleNext = async () => {
    // If we already have next page cached, just move the pointer right
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex((i) => i + 1);
      return;
    }

    // Otherwise, request next page (will be appended)
    if (hasNextPage && !isFetchingNextPage) {
      await fetchNextPage();
      // increment pointer to the appended page
      setCurrentPageIndex((i) => i + 1);
    }
  };

  const allFetchedProblems = useMemo(() => {
    if (!isSuccess || !data?.pages) return [];
    return data.pages.flatMap((p) => p.problems);
  }, [data?.pages, isSuccess]);

  const tags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const p of allFetchedProblems) {
      (p.tags || []).forEach((t) => tagSet.add(t.toLowerCase().trim()));
    }
    return Array.from(tagSet).sort();
  }, [allFetchedProblems]);

  if (isError) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Error fetching problems. Reload the page";
    toast({ title: "Error", description: message, variant: "destructive" });
  }

  const deleteMutation = useMutation<
    APISuccessResponse,
    AxiosError<APIErrorResponse>,
    number | string
  >({
    mutationFn: (problem_id: number | string) =>
      deleteProblem(problem_id, apiClient, isOnline),
    onSuccess: ({ message }) => {
      if (!isOnline) {
        refetch();
      } else {
        queryClient.invalidateQueries({ queryKey: ["problems"] });
      }
      toast({ title: "Success", description: message });
    },
    onError: (error) => {
      toast({
        title: error.response?.data?.error,
        description:
          error.response?.data?.message || "Failed to delete problem.",
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
      if (error.response?.status === 404)
        removeNotification(feedbackId as number);
      toast({
        title: error.response?.data?.error,
        description:
          error.response?.data?.message ||
          "Failed to submit practice feedback.",
        variant: "destructive",
      });
    },
  });

  const handlePracticeSubmit = (qualityScore: number) => {
    practiceMutation.mutate(qualityScore);
  };

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
    setAppliedFilters({});
    refetch();
  };

  const applyFilters = () => {
    const newFilters: AppQueryFilters = {};
    if (search.trim()) newFilters.queryStr = search.trim();
    if (selectedDifficulty) newFilters.difficulty = selectedDifficulty;
    if (selectedTag) newFilters.tag = selectedTag;
    if (selectedDate)
      newFilters.date_solved = format(selectedDate, "yyyy-MM-dd");

    const same = JSON.stringify(newFilters) === JSON.stringify(appliedFilters);
    if (!same) {
      queryClient.removeQueries({ queryKey: ["problems"] });
      setAppliedFilters(newFilters);
    }
  };

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

          <Button
            variant="outline"
            className="flex items-center flex-1"
            size="lg"
            onClick={applyFilters}
          >
            <ListFilter className="h-4 w-4" /> Apply
          </Button>
        </div>
      </div>
      {/* Problems List */}
      {currentPageProblems.length ? (
        <>
          <div className="border rounded-md">
            {currentPageProblems.map((problem) => (
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
                      <PopoverContent align="start" className="max-w-[900px]">
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
                    <CredenzaContent className="px-4 max-h-[95vh]">
                      <CredenzaHeader className="p-0">
                        <CredenzaTitle className="sr-only">
                          Problem Details
                        </CredenzaTitle>
                      </CredenzaHeader>
                      <div className="max-h-full p-1 drawer-content-wrapper">
                        <ProblemDetail problem={problem} tags={tags} />
                      </div>
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

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex justify-center sm:justify-end items-center gap-4 mt-4">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={
                  !(currentPageIndex > 0 || hasPreviousPage) ||
                  isFetchingPreviousPage
                }
                className="btn-outline"
              >
                <ArrowLeft className="h-4 w-4" /> Prev
              </Button>

              <span className="text-sm font-medium">
                {currentPage} of {totalPages}
              </span>

              <Button
                variant="outline"
                onClick={handleNext}
                disabled={
                  !(currentPageIndex < pages.length - 1 || hasNextPage) ||
                  isFetchingNextPage
                }
                className="btn-outline"
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
