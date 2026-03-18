import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { RouterModule } from '@angular/router';

@Component({
selector:'app-order-management',
standalone:true,
imports:[CommonModule,FormsModule, RouterModule],
templateUrl:'./order-management.html',
styleUrls:['./order-management.css']
})

export class OrderManagement implements OnInit{

orders:any[]=[];
filteredOrders:any[]=[];

searchQuery="";
activeTab="all";

tabs=[
 {id:"all",label:"Tất cả",count:0},
 {id:"pending",label:"Chờ xác nhận",count:0},
 {id:"confirmed",label:"Chờ giao hàng",count:0},
 {id:"delivered",label:"Đã giao",count:0},
 {id:"cancelled",label:"Đã hủy",count:0}
];


constructor(private api:ApiService){}

ngOnInit(){
this.loadOrders();
}

loadOrders(){

this.api.getOrders().subscribe((res:any)=>{

this.orders=res;
this.filteredOrders=res;

this.updateTabCounts();

});

}

updateTabCounts(){

this.tabs.forEach(tab=>{

if(tab.id==="all"){
tab.count=this.orders.length;
}else{
tab.count=this.orders.filter(o=>o.status===tab.id).length;
}

});

}

onTabClick(tab:string){

this.activeTab=tab;
this.filterOrders();

}

filterOrders(){

let data=this.orders;

if(this.activeTab!=="all"){
data=data.filter(o=>o.status===this.activeTab);
}

if(this.searchQuery){

const q=this.searchQuery.toLowerCase();

data=data.filter(o =>
o.customer.fullName.toLowerCase().includes(q)
);

}

this.filteredOrders=data;

}

formatCurrency(price:number){

return new Intl.NumberFormat('vi-VN',{
style:'currency',
currency:'VND'
}).format(price);

}

getStatusLabel(status:string){

const map:any={

pending:"Chờ xác nhận",
pending_payment:"Chờ giao hàng",
paid:"Đã giao",
cancelled:"Đã hủy"

};

return map[status];

}


// thêm để chạy nút mua lại nè

reorder(order:any){

order.items.forEach((item:any)=>{

this.api.addToCart({
productId:item.productId,
quantity:item.quantity
}).subscribe()

})

alert("Đã thêm lại sản phẩm vào giỏ hàng")

}




cancelOrder(orderId:string){

if(!confirm("Bạn có chắc muốn hủy đơn này?")) return;

this.api.cancelOrder(orderId).subscribe(()=>{

// load lại danh sách order từ server
this.loadOrders();

alert("Đơn hàng đã được hủy");

});


}





}