declare module 'react-dynoform' {
  import { ReactNode } from 'react';
  
  export interface FormField {
    key: string;
    label: string;
    type: 'text' | 'select' | 'checkbox' | 'date' | 'number' | 'email' | 'textarea';
    required?: boolean;
    options?: { label: string; value: string | number }[];
    defaultValue?: any;
  }

  export interface DynamicFormProps {
    fields: FormField[];
    selectedValues?: Record<string, any>;
    onSubmit?: (data: Record<string, any>) => void;
    onChange?: (data: Record<string, any>) => void;
    submitButtonLabel?: string;
    hideSubmit?: boolean;
  }

  const DynamicForm: React.FC<DynamicFormProps>;
  export default DynamicForm;
}