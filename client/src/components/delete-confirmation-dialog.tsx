import {
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "./ui/alert-dialog";

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void;
  resource: string;
}

const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({ open, resource, onOpenChange, onConfirmDelete }) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
        <AlertDialogDescription>
          { `Are you sure you want to delete this ${resource}?` }
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel
          onClick={() => onOpenChange(false)}
        >Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirmDelete}>
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  );
}

export default DeleteConfirmationDialog