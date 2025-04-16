import React, { useState } from "react";
import {
  AlertDialogHeader,
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from "./ui/alert-dialog";

import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

interface ProblemFeedbackDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (rating: number) => void;
}

const ratingDescriptions = [
  "I blanked",
  "I recalled some of it but my answer was wrong",
  "It was hard to recall, but my answer was correct",
  "I recalled most of it and my answer was correct",
  "I recalled it perfectly",
];

const ProblemFeedbackDialog: React.FC<ProblemFeedbackDialogProps> = ({
  isOpen,
  onOpenChange,
  onSubmit,
}) => {
  const [rating, setRating] = useState<number | null>(null);

  const handleRate = (value: number) => {
    setRating(value);
  };

  const handleSubmit = () => {
    if (rating) {
      onSubmit(rating);
      onOpenChange(false);
      setRating(null);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[90vw] sm:max-w-md rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg lg:text-xl font-bold">
            How well did you recall this problem?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Your feedback helps us optimize future reminders.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex justify-center gap-2 py-2">
          {Array.from({ length: 5 }, (_, i) => (
            <button
              key={i}
              onClick={() => handleRate(i + 1)}
              className="hover:scale-110 transition-transform"
            >
              <Star
                className={`w-6 h-6 ${
                  rating && i < rating
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-300"
                }`}
              />
            </button>
          ))}
        </div>

        {/* Rating Description */}
        {rating && (
          <p className="text-sm text-center text-muted-foreground italic">
            {ratingDescriptions[rating - 1]}
          </p>
        )}

        <div className="flex pt-2">
          <Button className="w-full" onClick={handleSubmit} disabled={!rating}>
            Submit
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ProblemFeedbackDialog;
