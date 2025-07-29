import React, { useState } from 'react';
import { User } from 'lucide-react';

interface CPFInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}

const CPFInput: React.FC<CPFInputProps> = ({ value, onChange, error, required = false }) => {
  const [isValid, setIsValid] = useState<boolean | null>(null);

  const formatCPF = (cpf: string) => {
    // Remove tudo que não é número
    const numbers = cpf.replace(/\D/g, '');
    
    // Aplica a máscara XXX.XXX.XXX-XX
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2');
    }
    
    return numbers.slice(0, 11)
      .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const validateCPF = (cpf: string) => {
    // Remove formatação
    const numbers = cpf.replace(/\D/g, '');
    
    // Verifica se tem 11 dígitos
    if (numbers.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(numbers)) return false;
    
    // Validação do primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(numbers[i]) * (10 - i);
    }
    let remainder = sum % 11;
    let digit1 = remainder < 2 ? 0 : 11 - remainder;
    
    if (parseInt(numbers[9]) !== digit1) return false;
    
    // Validação do segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(numbers[i]) * (11 - i);
    }
    remainder = sum % 11;
    let digit2 = remainder < 2 ? 0 : 11 - remainder;
    
    return parseInt(numbers[10]) === digit2;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    onChange(formatted);
    
    // Validar apenas se tem 11 dígitos
    const numbers = formatted.replace(/\D/g, '');
    if (numbers.length === 11) {
      setIsValid(validateCPF(formatted));
    } else {
      setIsValid(null);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        CPF {required && '*'}
      </label>
      <div className="relative">
        <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={handleChange}
          maxLength={14}
          className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
            error || (isValid === false) 
              ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
              : isValid === true
              ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
              : 'border-gray-300'
          }`}
          placeholder="000.000.000-00"
        />
        {isValid !== null && (
          <div className="absolute right-3 top-2.5">
            {isValid ? (
              <div className="w-4 h-4 text-green-500">✓</div>
            ) : (
              <div className="w-4 h-4 text-red-500">✗</div>
            )}
          </div>
        )}
      </div>
      {error && (
        <p className="text-red-600 text-sm mt-1">{error}</p>
      )}
      {isValid === false && !error && (
        <p className="text-red-600 text-sm mt-1">CPF inválido</p>
      )}
      {isValid === true && (
        <p className="text-green-600 text-sm mt-1">CPF válido</p>
      )}
    </div>
  );
};

export default CPFInput;