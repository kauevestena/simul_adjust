#include <iostream>
#include <armadillo>

#include <fstream>
#include <sstream>

#include <ostream>

#include <iomanip>

using namespace std;
using namespace arma;

/*
------------------------------------------------------

    TP02 de Ajustamento
    Prof. Dr. Ivandro Klein

    Alunos:
    Kauê de Moraes Vestena e Monyra Guttervill Cubas

    Obs:
    Todos os ângulos estão armazenados como
    radianos
-----------------------------------------------------
*/

double to_deg = (180/datum::pi);
double to_rad = (datum::pi/180);

//a number times itself
double sq(double input)
{
    return input*input;
}

void print2values(double in1,double in2)
{
    //to deal with many tests
    cout<<in1<<"    "<<in2<<endl;
}

void print3values(double in1,double in2,double in3)
{
    //to deal with many tests
    cout<<in1<<"    "<<in2<<"    "<<in3<<endl;
}

struct pontoENh
{
    string name;
    double E,N,h;
    double sE,sN,sh;
    vec2 vector2d;
    double dp2D;

    pontoENh(double,double,double,double,double,double,string);

    void as2dVector();
};

void pontoENh::as2dVector()
{
    vector2d(0) = E;
    vector2d(1) = N;
}

pontoENh::pontoENh(double _E,double _N,double _h,double _sE,
                   double _sN,double _sh,string _name)
{

    E = _E;
    N = _N;
    h = _h;
    sE = _sE;
    sN = _sN;
    sh = _sh;
    name = _name;

    dp2D = sqrt(sq(sE)+sq(sN));

    as2dVector();
}

//

struct GMS
{
//estrutura para Graus Minutos e Segundos
    double G,M,S;

    double Gdec;

    GMS(double g,double m,double s);
    GMS(double _Gdec,bool israd);

    double gdec();
    double rad();
};

double GMS::gdec()
{
//transformação de graus hexagesimais para decimais
    return double(G)+ (double(M)/60) + (double(S)/3600);
}

GMS::GMS (double g,double m,double s)
{
    G=g;
    M=m;
    S=s;

    Gdec = double(G)+ (double(M)/60) + (double(S)/3600);

//    gdec();
}

GMS::GMS(double _Gdec,bool israd)
{
    Gdec = _Gdec;

    if (israd)
    {
        Gdec *= (180/datum::pi);
    }
}



double GMS::rad()
{
//transformação de graus decimais para radianos
    double radd = gdec()  * (datum::pi/180);
    return radd;
}

struct angles2azimuths
{
    double Az;
    double dp;

    angles2azimuths(double AzR,double ang,double dpAzR,double dpAng,bool use180);
};

angles2azimuths::angles2azimuths(double AzR,double ang,double dpAzR,double dpAng,bool use180)
{
    Az = AzR + ang;

    Az *= to_deg;

    if (use180)
    {
        Az -=180.0;
    }

    if(Az > 360)
    {
        Az -= 360;
    }

    Az *= to_rad;

    dp = sqrt(sq(dpAzR)+sq(dpAng));
}

pontoENh transporte(pontoENh Est,double Az,double Dh,double dpAz,double dpDh,string name)
{
//    double E = Est.E + sin(to_rad*Az) * Dh;
//    double N = Est.N + cos(to_rad*Az) * Dh;
    double E = Est.E + sin(Az) * Dh;
    double N = Est.N + cos(Az) * Dh;
    //h será implementado em um futuro


    double dpE = sqrt(sq(Est.sE)+sq(sin(Az))*sq(dpDh)+
                      sq(cos(Az) * Dh)*sq(dpAz));
    double dpN = sqrt(sq(Est.sN)+sq(cos(Az))*sq(dpDh)+
                      sq(sin(Az) * Dh)*sq(dpAz));


    return pontoENh(E,N,0.00,dpE,dpN,0.00,name);
}

struct angleAndDP
{
    GMS angleGMS = GMS(0,0,0);
    GMS dpGMS    = GMS(0,0,0);
    double angle;
    double dp;
    string name;

    angleAndDP(double G,double M, double S, double g,double m,double s,string nAme);
};

angleAndDP::angleAndDP(double G,double M, double S, double g,double m,double s,string nAme)
{
    angleGMS = GMS(G,M,S);
    dpGMS    = GMS(g,m,s);
//    angle    = angleGMS.Gdec;
//    dp       = dpGMS.Gdec;

    angle = angleGMS.rad();
    dp       = dpGMS.rad();
    name = nAme;
}

struct valAndStd
{
    double val,dp;
    string name;

    valAndStd(double _val,double _dp,string nAme);
};

valAndStd::valAndStd(double _val,double _dp,string nAme)
{
    val = _val;
    dp  = _dp;
    name = nAme;
}

//para imprimir uma lista de pontos em um .csv
void printCSV(vector<pontoENh> input,string outname)
{
    ofstream out(outname);

    for (unsigned int i = 0; i < input.size(); i++)
    {
        out<<setprecision(15);
        out<<input.at(i).E<<",";
        out<<input.at(i).N<<",";
        out<<input.at(i).h<<",";
        out<<input.at(i).sE<<",";
        out<<input.at(i).sN<<",";
        out<<input.at(i).sh<<",";
        out<<input.at(i).name<<endl;
    }

    out.close();
}

double transpEqX(double XA,double XB,double d,double Az,vec ahs)
{
    return XA - XB + d * sin(Az + sum(ahs) - datum::pi * (ahs.size()-1) );
}


double transpEqY(double YA,double YB,double d,double Az,vec ahs)
{
    return YA - YB + d * cos(Az + sum(ahs) - datum::pi * (ahs.size()-1) );
}

double sumAnd180s(vec input,unsigned int endPos)
{
    vec temp = input.rows(0,endPos);
    return sum(temp) - datum::pi * (temp.size()-1);
}

double derivDist(double Az0,vec angs,unsigned int endPos,bool seno)
{
    //derivada da distância

    if (seno)
    {
        return sin(Az0 + sumAnd180s(angs,endPos));
    }
    else
    {
        return cos(Az0 + sumAnd180s(angs,endPos));
    }
}

double derivAngs(double dist,double Az0,vec angs,unsigned int endPos,bool isX)
{
    //para x:  dist * cos(somatorio)
    //para y: -dist * sen(somatorio)
    if (isX)
    {
        return  dist * cos(Az0 + sumAnd180s(angs,endPos));
    }
    else
    {
        return -dist * sin(Az0 + sumAnd180s(angs,endPos));
    }

}

int main()
{
    cout<<setprecision(10);

    //criando os vértices com coordenadas conhecidas
    pontoENh B_(8478.139,2483.826,0.0,0.005,0.003,0.0,"B");
    pontoENh E (7709.336,2263.411,0.0,0.004,0.004,0.0,"E");

    //criando azimutes de partida e chegada
    angleAndDP azBA( 68,15,20.7,0.0,0.0,4.2,"BA");
    angleAndDP azEF(300,11,30.5,0.0,0.0,3.6,"EF");

    //as distancias:
    valAndStd d1(281.832,0.003,"d1");
    valAndStd d2(271.300,0.003,"d2");
    valAndStd d3(274.100,0.003,"d3");

    //em um vetor:
//    vector<valAndStd> dists = {d1,d2,d3};
    vec dists = {d1.val,d2.val,d3.val};

    //os angulos horizontais
    angleAndDP A1(172,53,34,0.0,0.0,7.0,"A1");
    angleAndDP A2(185,22,14,0.0,0.0,7.0,"A2");
    angleAndDP A3(208,26,19,0.0,0.0,7.0,"A3");
    angleAndDP A4(205,13,51,0.0,0.0,7.0,"A4");

    //em um vetor:
//    vector<angleAndDP> angs = {A1,A2,A3,A4};

    vec angs = {A1.angle,A2.angle,A3.angle,A4.angle};

    ///cálculo das coordenadas aproximadas
    //calculo dos azimutes para as coordenadas aprox
    angles2azimuths azBC(azBA.angle,A1.angle,azBA.dp,A1.dp,false);
    angles2azimuths azCD(azBC.Az,A2.angle,azCD.dp,A2.dp,true);

    pontoENh C_ap = transporte(B_,azBC.Az,d1.val,azBC.dp,d1.dp,"C_temp");
    pontoENh D_ap = transporte(C_ap,azCD.Az,d2.val,azCD.dp,d2.dp,"D_temp");

    //imprimindo os valores aproximados para visualização
    vector<pontoENh> initialPoints = {B_,C_ap,D_ap,E};
    printCSV(initialPoints,"aprox.csv");

    //equacoes:

    /*
    AzAB + aABC + aBCD + aCDE + aDEF -(4-1)*180 - AzEF = 0
    XB + dBC * sen(AzAB + aABC)                      - XC = 0
    YB + dBC * cos(AzAB + aABC)                      - YC = 0
    XC + dCD * sen(AzAB + aABC + aBCD - 180)         - XD = 0
    YC + dCD * cos(AzAB + aABC + aBCD - 180)         - YD = 0
    XD + dDE * sen(AzAB + aABC + aBCD + aCDE - 360)  - XE = 0
    YD + dDE * cos(AzAB + aABC + aBCD + aCDE - 360)  - YE = 0
    */

    //numero de equações:
    unsigned int neq = 1+(angs.size()-1)*2;

    ///AJUSTAMENTO
    ofstream out("report.txt");

    out<<"TP02 de ajustamento"<<endl;
    out<<"Relatório de Saída"<<endl;

    //vetor X0 = {XB,YB,XC,YC,XD,YD,XE,YE}
    vec X0 = zeros(initialPoints.size()*2);
    vec temp1 = X0;
    unsigned int jjj = 0;
    for (unsigned int i = 0; i < initialPoints.size(); i++)
    {
        X0(jjj)      = initialPoints.at(i).E;
        X0(jjj+1)    = initialPoints.at(i).N;
        temp1(jjj)   = initialPoints.at(i).sE;
        temp1(jjj+1) = initialPoints.at(i).sN;
        jjj += 2;
    }

    X0.print(out,"vetor X0");out<<endl;

    //matriz dos pesos dos parametros (seção 14.2 de GEMAEL, 2004)
    mat Px = inv(diagmat(square(temp1)));

    Px.print(out,"Matriz Peso dos parâmetros");out<<endl;


    //vetor Lb = {dBC,dCD,dDE,aABC,aBCD,aCDE,aDEF,AzAB,AzEF}
    vec Lb =
    {
        d1.val,d2.val,d3.val,
        A1.angle,A2.angle,A3.angle,A4.angle,
        azBA.angle,azEF.angle
    };

    Lb.print(out,"Vetor Lb");out<<endl;

    //Matriz P
    vec temp2 =
    {
        d1.dp,d2.dp,d3.dp,
        A1.dp,A2.dp,A3.dp,A4.dp,
        azBA.dp,azEF.dp
    };

    mat P = inv(diagmat(square(temp2)));

    P.print(out,"Matriz Peso das observações");out<<endl;

    //constantes para final das iterações
    unsigned int maxIt = 100;
    double eps = 1e-3;

    //pre-alocação de matrizes e vetores

    //vetor erro de fechamento:
    vec W = zeros(neq);

    //matriz B
    mat B = zeros(neq,Lb.size());

    //Matriz A
    mat A = zeros(neq,X0.size());

    //predeclarações
    mat M,N;
    vec X,Xa;

    out<<endl;

    //processo iterativo
    for (unsigned int i = 0; i<maxIt; i++)
    {
    out<<endl;out<<endl;
    out<<"iteração num. "<<i<<endl;
    cout<<"iteração num. "<<i<<endl;

//        W(0) = azBA.angle - (angs.size()-1)*datum::pi + sum(angs);
        W(0) = azBA.angle + sumAnd180s(angs,angs.size()-1) - azEF.angle;
        unsigned int ii = 0;
        unsigned int jj = 0;
        for (unsigned int j = 1; j<W.n_rows; j = j+2)
        {
//            cout<<j<<","<<ii<<","<<jj<<endl;
            W(j  ) = transpEqX(X0(ii  ),X0(ii+2),dists(jj),azBA.angle,angs.rows(0,jj));
            W(j+1) = transpEqY(X0(ii+1),X0(ii+3),dists(jj),azBA.angle,angs.rows(0,jj));
            ii +=2;
            jj++;
        }

        W.print(out,"vetor W");out<<endl;

        /*
        AzAB + aABC + aBCD + aCDE + aDEF -(4-1)*180 - AzEF = 0
        XB + dBC * sen(AzAB + aABC)                      - XC = 0
        YB + dBC * cos(AzAB + aABC)                      - YC = 0
        XC + dCD * sen(AzAB + aABC + aBCD - 180)         - XD = 0
        YC + dCD * cos(AzAB + aABC + aBCD - 180)         - YD = 0
        XD + dDE * sen(AzAB + aABC + aBCD + aCDE - 360)  - XE = 0
        YD + dDE * cos(AzAB + aABC + aBCD + aCDE - 360)  - YE = 0
        */

        //vetor Lb = {dBC,dCD,dDE,aABC,aBCD,aCDE,aDEF,AzAB,AzEF}
        //vetor Lb = { 0,  1,  2,  3,   4,   5,   6,  7    ,8}

        //derivadas da equação de transporte de azimutes
        vec temp3 = {0,0,0,1,1,1,1,1,-1};
        B.row(0) = temp3.t();
        ii = 0;
        for (unsigned int j = 1; j < B.n_rows; j = j+2 )
        {
            //derivadas das distancias
            B(j  ,ii) = derivDist(azBA.angle,angs,ii,true);
            B(j+1,ii) = derivDist(azBA.angle,angs,ii,true);

            //derivadas dos angulos
            //para todos os angulos, em uma mesma linha a derivada será a mesma
            double dxda = derivAngs(dists(ii),azBA.angle,angs,ii,true );
            double dyda = derivAngs(dists(ii),azBA.angle,angs,ii,false);

//            B(j  ,dists.size()) = dxda;
//            B(j+1,dists.size()) = dyda;

            for (unsigned int jjj = 0;jjj<=ii;jjj++)
            {
                B(j  ,dists.size()+jjj) = dxda;
                B(j+1,dists.size()+jjj) = dyda;
            }

            //derivadas para o azimute de partida
            B(j  ,dists.size()+angs.size()) = dxda;
            B(j+1,dists.size()+angs.size()) = dyda;

            ii++;
        }

        B.print(out,"Matriz B");out<<endl;


        //matriz A
            //vetor X0 = {XB,YB,XC,YC,XD,YD,XE,YE}
        for (unsigned int j = 1; j < A.n_rows;j = j+2)
        {
            A(j,j-1)=1;A(j,j+1  )=-1;
            A(j+1,j)=1;A(j+1,j+2)=-1;
        }

        A.print(out,"Matriz A");out<<endl;

        //matriz M:
        M = B * P.i() * B.t();

        M.print(out,"Matriz M");out<<endl;

        //matriz das equações normais N
        N = A.t()*M.i()*A;

        N.print(out,"Matriz N");out<<endl;

        //vetor das correções a X0
        X = -inv(N+Px) * A.t() * M.i() * W;

        X.print(out,"Vetor X");out<<endl;

        out<<"numero de condição da matriz N "<<cond(N)<<endl<<endl;
        out<<"numero de condição da matriz M "<<cond(M)<<endl<<endl;

        out<<"recíproco do numero de condição da matriz N "<<rcond(N)<<endl<<endl;
        out<<"recíproco do numero de condição da matriz M "<<rcond(M)<<endl<<endl;

        //vetor Xa
        Xa = X0 + X;

        //critério de parada
        if(max(abs(X)) < eps ){break;}

        X0 = Xa;

    }

    //parametros ajustados
    Xa.print(out,"parâmetros ajustados (Xa)");

    //vetor K, multiplicadores de lagrange
    vec K = -M.i()*(A*X+W);

    K.print(out,"vetor K");out<<endl;

    //vetor dos resíduos V
    vec V = P.i()*B.t()*K;

    V.print(out,"vetor V");out<<endl;

    //vetor La, observações ajustadas
    vec La = Lb + V;

    La.print(out,"vetor La");out<<endl;

    //variância a posteriori
    double vp = as_scalar((V.t()*P*V+X.t()*Px*X)/(W.n_rows-X0.n_rows+X0.n_rows));

    out<<endl<<"variancia a posteriori "<<vp<<endl<<endl;

        vp = 1.0;


    //MVC dos parametros ajustados
    mat mvcXa = vp*inv(N+Px);

    mvcXa.print(out,"MVC dos parâmetros ajustados");out<<endl;

    //saida, para visualização dos vértices ajustados
    ofstream vertAjust("pontos.csv");

    vector<string> pointNames = {"B","B","C","C","D","D","E","E"};

    for (unsigned int i = 0; i < Xa.n_rows;i = i+2)
    {
        vertAjust<<setprecision(8)<<Xa(i)<<","<<Xa(i+1)<<","<<sqrt(mvcXa(i,i))<<","<<sqrt(mvcXa(i+1,i+1))<<","<<pointNames.at(i)<<endl;
    }

    return 0;

}
