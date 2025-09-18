import type { Pedido } from '../types';

type PedidoNivel = Pedido['nivel_atual'];
type PedidoStatus = Pedido['status'];

export const getNivelBadgeClass = (nivel: PedidoNivel) => {
  switch (nivel) {
    case 'singular':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'federacao':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'confederacao':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const getStatusBadgeClass = (status: PedidoStatus) => {
  switch (status) {
    case 'novo':
      return 'bg-blue-100 text-blue-800';
    case 'em_andamento':
      return 'bg-yellow-100 text-yellow-800';
    case 'concluido':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getStatusCardColors = (status: PedidoStatus) => {
  switch (status) {
    case 'novo':
      return {
        borderClass: 'border-transparent',
        backgroundClass: '',
        borderColor: '#FFF087',
        backgroundColor: '#F9FDDC',
      };
    case 'em_andamento':
      return {
        borderClass: 'border-transparent',
        backgroundClass: '',
        borderColor: '#3AC4FF',
        backgroundColor: '#DAF7FF',
      };
    case 'concluido':
      return {
        borderClass: 'border-transparent',
        backgroundClass: '',
        borderColor: '#00c951',
        backgroundColor: '#f0fdf5',
      };
    default:
      return {
        borderClass: 'border-gray-200',
        backgroundClass: 'bg-white',
        borderColor: '#e5e7eb',
        backgroundColor: '#ffffff',
      };
  }
};
